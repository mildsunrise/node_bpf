#include <memory>
#include <string>
#include <sstream>
#include <cassert>
#include <stdio.h>
#include <fcntl.h>

#include <unistd.h>
#include <linux/btf.h>
#include <sys/utsname.h>

#include <bpf.h>
#include <errno.h>

#include <napi.h>

using Napi::CallbackInfo;


std::string GetString(Napi::Env env, Napi::Value value) {
    if (!value.IsString())
        throw Napi::TypeError::New(env, "String expected");
    return Napi::String(env, value);
}

template<class T>
T GetNumber(Napi::Env env, Napi::Value value) {
    return Napi::Number(env, value);
}

template<class T>
T GetNumber(Napi::Env env, Napi::Value value, T def) {
    return value.IsUndefined() ? def : GetNumber<T>(env, value);
}

bool GetBoolean(Napi::Env env, Napi::Value value) {
    return Napi::Boolean(env, value);
}

uint64_t GetUint64(Napi::Env env, Napi::Value value) {
    bool lossless;
    uint64_t result = Napi::BigInt(env, value).Uint64Value(&lossless);
    if (!lossless)
        throw Napi::RangeError::New(env, "Bigint outside uint64_t range");
    return result;
}

uint64_t GetUint64(Napi::Env env, Napi::Value value, uint64_t def) {
    // FIXME: verify that info[234] returns an empty Napi::Value
    return value.IsUndefined() ? def : GetUint64(env, value);
}

uint8_t* GetBuffer(Napi::Env env, Napi::Value x) {
    return Napi::TypedArrayOf<uint8_t>(env, x).Data();
}

uint8_t* GetOptionalBuffer(Napi::Env env, Napi::Value x) {
    if (x.IsUndefined())
        return nullptr;
    return GetBuffer(env, x);
}

Napi::Value ToStatus(Napi::Env env, int ret) {
    return Napi::Number::New(env, (ret < 0) ? -errno : ret);
}

class FDRef : public Napi::ObjectWrap<FDRef> {
  public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "FDRef", {
            InstanceMethod<&FDRef::Close>("close"),
            InstanceAccessor("fd", &FDRef::GetFD, nullptr),
            InstanceMethod<&FDRef::ToString>("toString"),
        });
        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        exports["FDRef"] = func;
        env.SetInstanceData<Napi::FunctionReference>(constructor);
        return exports;
    }

    FDRef(const CallbackInfo& info) : Napi::ObjectWrap<FDRef>(info),
        fd(Napi::Number(info.Env(), info[0])) {}
    
    ~FDRef() {
        // Not sure if we should print a warning when closing via GC...
        // FileHandle does, but file FDs are of different nature than
        // kernel object references IMHO.
        doClose();
    }

    void doClose() {
        if (fd != -1) {
            int status = close(fd);
            if (status != 0)
                fprintf(stderr, "node_bpf: warning: descriptor %d failed to close, possible ownership issues\n", fd);
            fd = -1;
        }
    }

  private:
    int fd;

    Napi::Value GetFD(const CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (fd == -1)
            throw Napi::Error::New(env, "FD was closed");
        return Napi::Number::New(env, fd);
    }

    void Close(const CallbackInfo& info) {
        doClose();
    }

    Napi::Value ToString(const CallbackInfo& info) {
        Napi::Env env = info.Env();
        std::stringstream str;
        str << "<FDRef: ";
        if (fd == -1) str << "closed";
        else str << fd;
        str << ">";
        return Napi::String::New(env, str.str());
    }
};

Napi::Value Dup(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    auto fd = GetNumber<int>(env, info[0]);
    return ToStatus(env, fcntl(fd, F_DUPFD, 0));
}

Napi::Value MapUpdateElem(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto key = GetBuffer(env, info[a++]);
    auto value = GetBuffer(env, info[a++]);
    auto flags = GetNumber<uint32_t>(env, info[a++]);
    return ToStatus(env, bpf_map_update_elem(fd, key, value, flags));
}

Napi::Value MapLookupElem(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto key = GetBuffer(env, info[a++]);
    auto value = GetBuffer(env, info[a++]);
    auto flags = GetNumber<uint32_t>(env, info[a++]);
    return ToStatus(env, bpf_map_lookup_elem_flags(fd, key, value, flags));
}

Napi::Value MapLookupAndDeleteElem(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto key = GetBuffer(env, info[a++]);
    auto value = GetBuffer(env, info[a++]);
    return ToStatus(env, bpf_map_lookup_and_delete_elem(fd, key, value));
}

Napi::Value MapDeleteElem(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto key = GetBuffer(env, info[a++]);
    return ToStatus(env, bpf_map_delete_elem(fd, key));
}

Napi::Value MapGetNextKey(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto key = GetOptionalBuffer(env, info[a++]);
    auto next_key = GetBuffer(env, info[a++]);
    return ToStatus(env, bpf_map_get_next_key(fd, key, next_key));
}

Napi::Value MapFreeze(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    return ToStatus(env, bpf_map_freeze(fd));
}

bpf_map_batch_opts GetBatchOpts(Napi::Env env, Napi::Value x) {
    Napi::Object obj (env, x);
    bpf_map_batch_opts ret {};
    ret.sz = sizeof(ret);
    ret.elem_flags = GetNumber<uint32_t>(env, obj["elemFlags"], 0);
    ret.flags = GetNumber<uint32_t>(env, obj["flags"], 0);
    return ret;
}

Napi::Value MapDeleteBatch(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto keys = GetBuffer(env, info[a++]);
    auto count = GetNumber<uint32_t>(env, info[a++]);
    auto opts = GetBatchOpts(env, info[a++]);
    
    auto ret = Napi::Array::New(env);
    ret[0U] = ToStatus(env, bpf_map_delete_batch(fd, keys, &count, &opts));
    ret[1U] = Napi::Number::New(env, count);
    return ret;
}

Napi::Value MapLookupBatch(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto in_batch = info[a].IsUndefined() ? nullptr : GetBuffer(env, info[a]); a++;
    auto out_batch = GetBuffer(env, info[a++]);
    auto keys = GetBuffer(env, info[a++]);
    auto values = GetBuffer(env, info[a++]);
    auto count = GetNumber<uint32_t>(env, info[a++]);
    auto opts = GetBatchOpts(env, info[a++]);
    
    auto ret = Napi::Array::New(env);
    ret[0U] = ToStatus(env, bpf_map_lookup_batch(fd, in_batch, out_batch, keys, values, &count, &opts));
    ret[1U] = Napi::Number::New(env, count);
    return ret;
}

Napi::Value MapLookupAndDeleteBatch(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto in_batch = info[a].IsUndefined() ? nullptr : GetBuffer(env, info[a]); a++;
    auto out_batch = GetBuffer(env, info[a++]);
    auto keys = GetBuffer(env, info[a++]);
    auto values = GetBuffer(env, info[a++]);
    auto count = GetNumber<uint32_t>(env, info[a++]);
    auto opts = GetBatchOpts(env, info[a++]);
    
    auto ret = Napi::Array::New(env);
    ret[0U] = ToStatus(env, bpf_map_lookup_and_delete_batch(fd, in_batch, out_batch, keys, values, &count, &opts));
    ret[1U] = Napi::Number::New(env, count);
    return ret;
}

Napi::Value MapUpdateBatch(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto keys = GetBuffer(env, info[a++]);
    auto values = GetBuffer(env, info[a++]);
    auto count = GetNumber<uint32_t>(env, info[a++]);
    auto opts = GetBatchOpts(env, info[a++]);
    
    auto ret = Napi::Array::New(env);
    ret[0U] = ToStatus(env, bpf_map_update_batch(fd, keys, values, &count, &opts));
    ret[1U] = Napi::Number::New(env, count);
    return ret;
}

Napi::Value CreateMap(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object desc (env, info[0]);
    bpf_create_map_attr attr {};
    attr.map_type = (bpf_map_type) GetNumber<uint32_t>(env, desc["type"]);
    attr.map_flags = GetNumber<uint32_t>(env, desc["flags"]);
    attr.key_size = GetNumber<uint32_t>(env, desc["keySize"]);
    attr.value_size = GetNumber<uint32_t>(env, desc["valueSize"]);
    attr.max_entries = GetNumber<uint32_t>(env, desc["maxEntries"]);
    attr.numa_node = GetNumber<uint32_t>(env, desc["numaNode"], 0);
    attr.inner_map_fd = GetNumber<uint32_t>(env, desc["innerMap"], 0);
    attr.map_ifindex = GetNumber<uint32_t>(env, desc["ifindex"], 0);
    std::string name;
    if (desc.Has("name")) {
        name = GetString(env, desc["name"]);
        attr.name = name.c_str();
    }
    return ToStatus(env, bpf_create_map_xattr(&attr));
}

Napi::Value GetMapInfo(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    auto fd = GetNumber<int>(env, info[0]);
    bpf_map_info map_info {};
    uint32_t info_size = sizeof(map_info);
    auto ret = Napi::Array::New(env);
    ret[0U] = ToStatus(env, bpf_obj_get_info_by_fd(fd, &map_info, &info_size));
    // FIXME: verify fd is a map, or remove claim from docs
    auto obj = Napi::Object::New(env);
    obj["type"] = Napi::Number::New(env, (uint32_t) map_info.type);
    obj["id"] = Napi::Number::New(env, map_info.id);
    obj["keySize"] = Napi::Number::New(env, map_info.key_size);
    obj["valueSize"] = Napi::Number::New(env, map_info.value_size);
    obj["maxEntries"] = Napi::Number::New(env, map_info.max_entries);
    obj["flags"] = Napi::Number::New(env, map_info.map_flags);
    if (info_size >= offsetof(bpf_map_info, name) + sizeof(map_info.name))
        obj["name"] = Napi::String::New(env, map_info.name);
    if (info_size >= offsetof(bpf_map_info, ifindex) + sizeof(map_info.ifindex))
        obj["ifindex"] = Napi::Number::New(env, map_info.ifindex);
    if (info_size >= offsetof(bpf_map_info, netns_dev) + sizeof(map_info.netns_dev))
        obj["netnsDev"] = Napi::BigInt::New(env, (uint64_t) map_info.netns_dev);
    if (info_size >= offsetof(bpf_map_info, netns_ino) + sizeof(map_info.netns_ino))
        obj["netnsIno"] = Napi::BigInt::New(env, (uint64_t) map_info.netns_ino);
    ret[1U] = obj;
    return ret;
}

Napi::Value MapGetFdById(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto id = GetNumber<uint32_t>(env, info[a++]);
    return ToStatus(env, bpf_map_get_fd_by_id(id));
}

Napi::Value BpfObjGet(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto path = GetString(env, info[a++]);
    return ToStatus(env, bpf_obj_get(path.c_str()));
}

#define EXPOSE_FUNCTION(NAME, METHOD) exports.Set(NAME, Napi::Function::New(env, METHOD, NAME))

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    auto versions = Napi::Object::New(env);
    // Keep synchronized with deps
    versions["libelf"] = Napi::String::New(env, "0.180");
    versions["libbpf"] = Napi::String::New(env, "0.9.0");
    versions["btf"] = Napi::Number::New(env, BTF_VERSION);
    utsname kernel_info;
    if (!uname(&kernel_info))
        versions["kernel"] = Napi::String::New(env, kernel_info.release);
    exports["versions"] = versions;

    FDRef::Init(env, exports);
    EXPOSE_FUNCTION("dup", Dup);

    EXPOSE_FUNCTION("mapUpdateElem", MapUpdateElem);
    EXPOSE_FUNCTION("mapLookupElem", MapLookupElem);
    EXPOSE_FUNCTION("mapLookupAndDeleteElem", MapLookupAndDeleteElem);
    EXPOSE_FUNCTION("mapDeleteElem", MapDeleteElem);
    EXPOSE_FUNCTION("mapGetNextKey", MapGetNextKey);
    EXPOSE_FUNCTION("mapFreeze", MapFreeze);
    EXPOSE_FUNCTION("mapDeleteBatch", MapDeleteBatch);
    EXPOSE_FUNCTION("mapLookupBatch", MapLookupBatch);
    EXPOSE_FUNCTION("mapLookupAndDeleteBatch", MapLookupAndDeleteBatch);
    EXPOSE_FUNCTION("mapUpdateBatch", MapUpdateBatch);
    EXPOSE_FUNCTION("createMap", CreateMap);
    EXPOSE_FUNCTION("getMapInfo", GetMapInfo);
    EXPOSE_FUNCTION("mapGetFdById", MapGetFdById);
    EXPOSE_FUNCTION("bpfObjGet", BpfObjGet);

    return exports;
}

NODE_API_MODULE(bpf_binding, Init)
