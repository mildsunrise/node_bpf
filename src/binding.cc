#include <memory>
#include <string>

#include <bpf/bpf.h>
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

bpf_probe_attach_type GetAttachType(Napi::Env env, Napi::Value value) {
    return (bpf_probe_attach_type) GetNumber<int>(env, value, (int) BPF_PROBE_ENTRY);
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
    bpf_map_batch_opts ret {};
    ret.sz = sizeof(ret);
    return ret;
}

// FIXME: what does in_batch / out_batch do?

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
    auto keys = GetBuffer(env, info[a++]);
    auto values = GetBuffer(env, info[a++]);
    auto count = GetNumber<uint32_t>(env, info[a++]);
    auto opts = GetBatchOpts(env, info[a++]);
    
    auto ret = Napi::Array::New(env);
    ret[0U] = ToStatus(env, bpf_map_lookup_batch(fd, NULL, NULL, keys, values, &count, &opts));
    ret[1U] = Napi::Number::New(env, count);
    return ret;
}

Napi::Value MapLookupAndDeleteBatch(const CallbackInfo& info) {
    Napi::Env env = info.Env();
    size_t a = 0;
    auto fd = GetNumber<uint32_t>(env, info[a++]);
    auto keys = GetBuffer(env, info[a++]);
    auto values = GetBuffer(env, info[a++]);
    auto count = GetNumber<uint32_t>(env, info[a++]);
    auto opts = GetBatchOpts(env, info[a++]);
    
    auto ret = Napi::Array::New(env);
    ret[0U] = ToStatus(env, bpf_map_lookup_and_delete_batch(fd, NULL, NULL, keys, values, &count, &opts));
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

#define EXPOSE_FUNCTION(NAME, METHOD) exports.Set(NAME, Napi::Function::New(env, METHOD, NAME))

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports["ENOENT"] = Napi::Number::New(env, ENOENT);

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

    return exports;
}

NODE_API_MODULE(bpf_binding, Init)
