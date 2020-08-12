{
    "targets": [
        {
            "target_name": "bpf_binding",
            "sources": [ "src/binding.cc" ],
            "include_dirs": [
                "<!@(node -p \"require('node-addon-api').include\")",
            ],
            
            # Enable exceptions
            "cflags!": [ "-fno-exceptions" ],
            "cflags_cc!": [ "-fno-exceptions" ],
            "xcode_settings": {
                "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                "CLANG_CXX_LIBRARY": "libc++",
                "MACOSX_DEPLOYMENT_TARGET": "10.7",
            },
            "msvs_settings": {
                "VCCLCompilerTool": { "ExceptionHandling": 1 },
            },
            
            # TODO
        }
    ],
}
