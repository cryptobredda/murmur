# Android-only additions to the pinned official NeMo-Speech.cpp source build.
target_link_libraries(nemo_speech_asr PRIVATE log)
foreach(target nemo_speech_asr nemo_speech_asr_c ggml ggml-base ggml-cpu)
    # Android's APK loader expects .so names, without Unix .so.1 suffixes.
    set_target_properties(${target} PROPERTIES VERSION "" SOVERSION "")
endforeach()
add_library(murmur_nemotron SHARED "${CMAKE_CURRENT_LIST_DIR}/nemotron-jni.cpp")
target_include_directories(murmur_nemotron PRIVATE "${CMAKE_SOURCE_DIR}/include")
target_link_libraries(murmur_nemotron PRIVATE nemo_speech_asr_c log)
