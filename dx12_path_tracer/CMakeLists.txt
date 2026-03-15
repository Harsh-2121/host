cmake_minimum_required(VERSION 3.20)
project(DX12PathTracer LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(dx12_path_tracer src/main.cpp)

target_compile_definitions(dx12_path_tracer PRIVATE UNICODE _UNICODE)
if (MSVC)
    target_compile_options(dx12_path_tracer PRIVATE /W4 /permissive-)
endif()

if (WIN32)
    target_link_libraries(dx12_path_tracer
        PRIVATE
        d3d12
        dxgi
        dxguid
        d3dcompiler
    )
endif()

add_custom_command(TARGET dx12_path_tracer POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/shaders/pathtracer.hlsl
        $<TARGET_FILE_DIR:dx12_path_tracer>/pathtracer.hlsl
)
