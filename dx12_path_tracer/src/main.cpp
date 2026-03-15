#include <windows.h>
#include <wrl/client.h>
#include <d3d12.h>
#include <dxgi1_6.h>
#include <d3dcompiler.h>

#include <array>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
#include <cstring>

using Microsoft::WRL::ComPtr;

namespace
{
    constexpr uint32_t kWidth = 1280;
    constexpr uint32_t kHeight = 720;

    struct alignas(16) SphereGPU
    {
        float center[3];
        float radius;
        float albedo[3];
        uint32_t materialType;
        float fuzz;
        float padding[2];
    };

    struct alignas(16) SceneConstants
    {
        uint32_t width;
        uint32_t height;
        uint32_t frameIndex;
        uint32_t sphereCount;

        float cameraPos[3];
        float pad0;
        float cameraForward[3];
        float pad1;
        float cameraRight[3];
        float pad2;
        float cameraUp[3];
        float pad3;

        float lightPosition[3];
        float lightIntensity;
        float lightColor[3];
        float pad4;
    };

    void ThrowIfFailed(HRESULT hr, const char* message)
    {
        if (FAILED(hr))
        {
            throw std::runtime_error(message);
        }
    }

    void WaitForGpu(ID3D12CommandQueue* queue, ID3D12Fence* fence, HANDLE fenceEvent, uint64_t& fenceValue)
    {
        fenceValue++;
        ThrowIfFailed(queue->Signal(fence, fenceValue), "Failed to signal fence");

        if (fence->GetCompletedValue() < fenceValue)
        {
            ThrowIfFailed(fence->SetEventOnCompletion(fenceValue, fenceEvent), "Failed to set fence event");
            WaitForSingleObject(fenceEvent, INFINITE);
        }
    }

    void SaveAsPPM(const std::wstring& filePath, const std::vector<uint8_t>& rgbaPixels, uint32_t width, uint32_t height)
    {
        std::ofstream file(filePath, std::ios::binary);
        if (!file)
        {
            throw std::runtime_error("Failed to open output file");
        }

        file << "P6\n" << width << " " << height << "\n255\n";
        for (uint32_t i = 0; i < width * height; ++i)
        {
            const uint8_t* px = &rgbaPixels[i * 4];
            file.write(reinterpret_cast<const char*>(px), 3);
        }
    }
}

int wmain()
{
    try
    {
        ComPtr<IDXGIFactory6> factory;
        ThrowIfFailed(CreateDXGIFactory2(0, IID_PPV_ARGS(&factory)), "CreateDXGIFactory2 failed");

        ComPtr<IDXGIAdapter1> adapter;
        for (UINT adapterIndex = 0; factory->EnumAdapterByGpuPreference(adapterIndex, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, IID_PPV_ARGS(&adapter)) != DXGI_ERROR_NOT_FOUND; ++adapterIndex)
        {
            DXGI_ADAPTER_DESC1 desc{};
            adapter->GetDesc1(&desc);
            if (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE)
            {
                continue;
            }

            if (SUCCEEDED(D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_12_0, __uuidof(ID3D12Device), nullptr)))
            {
                break;
            }
        }

        ComPtr<ID3D12Device> device;
        ThrowIfFailed(D3D12CreateDevice(adapter.Get(), D3D_FEATURE_LEVEL_12_0, IID_PPV_ARGS(&device)), "D3D12CreateDevice failed");

        D3D12_COMMAND_QUEUE_DESC queueDesc{};
        queueDesc.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;
        ComPtr<ID3D12CommandQueue> queue;
        ThrowIfFailed(device->CreateCommandQueue(&queueDesc, IID_PPV_ARGS(&queue)), "CreateCommandQueue failed");

        ComPtr<ID3D12CommandAllocator> allocator;
        ThrowIfFailed(device->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, IID_PPV_ARGS(&allocator)), "CreateCommandAllocator failed");

        ComPtr<ID3D12GraphicsCommandList> commandList;
        ThrowIfFailed(device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, allocator.Get(), nullptr, IID_PPV_ARGS(&commandList)), "CreateCommandList failed");

        ComPtr<ID3D12Fence> fence;
        ThrowIfFailed(device->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&fence)), "CreateFence failed");
        uint64_t fenceValue = 0;
        HANDLE fenceEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
        if (!fenceEvent)
        {
            throw std::runtime_error("Failed to create fence event");
        }

        ComPtr<ID3DBlob> csBlob;
        ComPtr<ID3DBlob> errorBlob;
        UINT compileFlags = D3DCOMPILE_ENABLE_STRICTNESS;
        HRESULT compileResult = D3DCompileFromFile(
            L"pathtracer.hlsl",
            nullptr,
            D3D_COMPILE_STANDARD_FILE_INCLUDE,
            "main",
            "cs_5_1",
            compileFlags,
            0,
            &csBlob,
            &errorBlob);

        if (FAILED(compileResult))
        {
            if (errorBlob)
            {
                std::cerr << static_cast<const char*>(errorBlob->GetBufferPointer()) << "\n";
            }
            throw std::runtime_error("Shader compilation failed");
        }

        D3D12_DESCRIPTOR_RANGE ranges[2] = {};
        ranges[0].RangeType = D3D12_DESCRIPTOR_RANGE_TYPE_SRV;
        ranges[0].NumDescriptors = 1;
        ranges[0].BaseShaderRegister = 0;
        ranges[0].OffsetInDescriptorsFromTableStart = D3D12_DESCRIPTOR_RANGE_OFFSET_APPEND;

        ranges[1].RangeType = D3D12_DESCRIPTOR_RANGE_TYPE_UAV;
        ranges[1].NumDescriptors = 1;
        ranges[1].BaseShaderRegister = 0;
        ranges[1].OffsetInDescriptorsFromTableStart = D3D12_DESCRIPTOR_RANGE_OFFSET_APPEND;

        D3D12_ROOT_PARAMETER params[3] = {};
        params[0].ParameterType = D3D12_ROOT_PARAMETER_TYPE_CBV;
        params[0].Descriptor.ShaderRegister = 0;
        params[0].ShaderVisibility = D3D12_SHADER_VISIBILITY_ALL;

        params[1].ParameterType = D3D12_ROOT_PARAMETER_TYPE_DESCRIPTOR_TABLE;
        params[1].DescriptorTable.NumDescriptorRanges = 1;
        params[1].DescriptorTable.pDescriptorRanges = &ranges[0];
        params[1].ShaderVisibility = D3D12_SHADER_VISIBILITY_ALL;

        params[2].ParameterType = D3D12_ROOT_PARAMETER_TYPE_DESCRIPTOR_TABLE;
        params[2].DescriptorTable.NumDescriptorRanges = 1;
        params[2].DescriptorTable.pDescriptorRanges = &ranges[1];
        params[2].ShaderVisibility = D3D12_SHADER_VISIBILITY_ALL;

        D3D12_ROOT_SIGNATURE_DESC rootSigDesc{};
        rootSigDesc.NumParameters = static_cast<UINT>(std::size(params));
        rootSigDesc.pParameters = params;

        ComPtr<ID3DBlob> serializedRootSig;
        ThrowIfFailed(D3D12SerializeRootSignature(&rootSigDesc, D3D_ROOT_SIGNATURE_VERSION_1, &serializedRootSig, &errorBlob), "D3D12SerializeRootSignature failed");

        ComPtr<ID3D12RootSignature> rootSignature;
        ThrowIfFailed(device->CreateRootSignature(0, serializedRootSig->GetBufferPointer(), serializedRootSig->GetBufferSize(), IID_PPV_ARGS(&rootSignature)), "CreateRootSignature failed");

        D3D12_COMPUTE_PIPELINE_STATE_DESC psoDesc{};
        psoDesc.pRootSignature = rootSignature.Get();
        psoDesc.CS = {csBlob->GetBufferPointer(), csBlob->GetBufferSize()};

        ComPtr<ID3D12PipelineState> pso;
        ThrowIfFailed(device->CreateComputePipelineState(&psoDesc, IID_PPV_ARGS(&pso)), "CreateComputePipelineState failed");

        std::vector<SphereGPU> spheres = {
            {{0.0f, -1001.0f, 0.0f}, 1000.0f, {0.8f, 0.8f, 0.8f}, 0, 0.0f, {0.0f, 0.0f}}, // ground
            {{-1.4f, 0.6f, 4.5f}, 0.6f, {0.9f, 0.2f, 0.2f}, 0, 0.0f, {0.0f, 0.0f}},        // diffuse red
            {{0.0f, 0.6f, 4.0f}, 0.6f, {0.2f, 0.9f, 0.3f}, 0, 0.0f, {0.0f, 0.0f}},         // diffuse green
            {{1.4f, 0.6f, 3.7f}, 0.6f, {0.92f, 0.92f, 0.95f}, 1, 0.03f, {0.0f, 0.0f}}       // reflective metal sphere
        };

        SceneConstants scene{};
        scene.width = kWidth;
        scene.height = kHeight;
        scene.frameIndex = 1;
        scene.sphereCount = static_cast<uint32_t>(spheres.size());
        scene.cameraPos[0] = 0.0f; scene.cameraPos[1] = 1.1f; scene.cameraPos[2] = -3.5f;
        scene.cameraForward[0] = 0.0f; scene.cameraForward[1] = -0.1f; scene.cameraForward[2] = 1.0f;
        scene.cameraRight[0] = 1.0f; scene.cameraRight[1] = 0.0f; scene.cameraRight[2] = 0.0f;
        scene.cameraUp[0] = 0.0f; scene.cameraUp[1] = 1.0f; scene.cameraUp[2] = 0.0f;
        scene.lightPosition[0] = 0.0f; scene.lightPosition[1] = 5.0f; scene.lightPosition[2] = 2.0f;
        scene.lightIntensity = 80.0f;
        scene.lightColor[0] = 1.0f; scene.lightColor[1] = 0.95f; scene.lightColor[2] = 0.9f;

        auto createUploadBuffer = [&](size_t size, const void* data, ComPtr<ID3D12Resource>& resource)
        {
            D3D12_HEAP_PROPERTIES heapProps{};
            heapProps.Type = D3D12_HEAP_TYPE_UPLOAD;

            D3D12_RESOURCE_DESC desc{};
            desc.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER;
            desc.Width = size;
            desc.Height = 1;
            desc.DepthOrArraySize = 1;
            desc.MipLevels = 1;
            desc.SampleDesc.Count = 1;
            desc.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR;
            ThrowIfFailed(device->CreateCommittedResource(
                &heapProps,
                D3D12_HEAP_FLAG_NONE,
                &desc,
                D3D12_RESOURCE_STATE_GENERIC_READ,
                nullptr,
                IID_PPV_ARGS(&resource)), "CreateCommittedResource upload failed");

            void* mapped = nullptr;
            ThrowIfFailed(resource->Map(0, nullptr, &mapped), "Map upload failed");
            memcpy(mapped, data, size);
            resource->Unmap(0, nullptr);
        };

        ComPtr<ID3D12Resource> sceneCB;
        createUploadBuffer(sizeof(SceneConstants), &scene, sceneCB);

        ComPtr<ID3D12Resource> sphereBuffer;
        createUploadBuffer(sizeof(SphereGPU) * spheres.size(), spheres.data(), sphereBuffer);

        ComPtr<ID3D12Resource> outputTexture;
        {
            D3D12_HEAP_PROPERTIES defaultHeap{};
            defaultHeap.Type = D3D12_HEAP_TYPE_DEFAULT;

            D3D12_RESOURCE_DESC textureDesc{};
            textureDesc.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D;
            textureDesc.Width = kWidth;
            textureDesc.Height = kHeight;
            textureDesc.DepthOrArraySize = 1;
            textureDesc.MipLevels = 1;
            textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
            textureDesc.SampleDesc.Count = 1;
            textureDesc.Layout = D3D12_TEXTURE_LAYOUT_UNKNOWN;
            textureDesc.Flags = D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS;

            ThrowIfFailed(device->CreateCommittedResource(
                &defaultHeap,
                D3D12_HEAP_FLAG_NONE,
                &textureDesc,
                D3D12_RESOURCE_STATE_UNORDERED_ACCESS,
                nullptr,
                IID_PPV_ARGS(&outputTexture)), "Create output texture failed");
        }

        ComPtr<ID3D12DescriptorHeap> srvUavHeap;
        {
            D3D12_DESCRIPTOR_HEAP_DESC heapDesc{};
            heapDesc.NumDescriptors = 2;
            heapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV;
            heapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE;
            ThrowIfFailed(device->CreateDescriptorHeap(&heapDesc, IID_PPV_ARGS(&srvUavHeap)), "CreateDescriptorHeap failed");
        }

        UINT descriptorSize = device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
        D3D12_CPU_DESCRIPTOR_HANDLE srvHandle = srvUavHeap->GetCPUDescriptorHandleForHeapStart();
        D3D12_CPU_DESCRIPTOR_HANDLE uavHandle = srvHandle;
        uavHandle.ptr += descriptorSize;

        D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc{};
        srvDesc.Format = DXGI_FORMAT_UNKNOWN;
        srvDesc.ViewDimension = D3D12_SRV_DIMENSION_BUFFER;
        srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
        srvDesc.Buffer.NumElements = static_cast<UINT>(spheres.size());
        srvDesc.Buffer.StructureByteStride = sizeof(SphereGPU);
        device->CreateShaderResourceView(sphereBuffer.Get(), &srvDesc, srvHandle);

        D3D12_UNORDERED_ACCESS_VIEW_DESC uavDesc{};
        uavDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
        uavDesc.ViewDimension = D3D12_UAV_DIMENSION_TEXTURE2D;
        device->CreateUnorderedAccessView(outputTexture.Get(), nullptr, &uavDesc, uavHandle);

        D3D12_RESOURCE_DESC outDesc = outputTexture->GetDesc();
        UINT64 readbackSize = 0;
        D3D12_PLACED_SUBRESOURCE_FOOTPRINT footprint{};
        device->GetCopyableFootprints(&outDesc, 0, 1, 0, &footprint, nullptr, nullptr, &readbackSize);

        ComPtr<ID3D12Resource> readbackBuffer;
        {
            D3D12_HEAP_PROPERTIES readbackHeap{};
            readbackHeap.Type = D3D12_HEAP_TYPE_READBACK;
            D3D12_RESOURCE_DESC bufferDesc{};
            bufferDesc.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER;
            bufferDesc.Width = readbackSize;
            bufferDesc.Height = 1;
            bufferDesc.DepthOrArraySize = 1;
            bufferDesc.MipLevels = 1;
            bufferDesc.SampleDesc.Count = 1;
            bufferDesc.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR;
            ThrowIfFailed(device->CreateCommittedResource(
                &readbackHeap,
                D3D12_HEAP_FLAG_NONE,
                &bufferDesc,
                D3D12_RESOURCE_STATE_COPY_DEST,
                nullptr,
                IID_PPV_ARGS(&readbackBuffer)), "Create readback buffer failed");
        }

        ThrowIfFailed(commandList->SetName(L"PathTracerCommandList"), "Failed to set command list name");

        commandList->SetComputeRootSignature(rootSignature.Get());
        ID3D12DescriptorHeap* heaps[] = {srvUavHeap.Get()};
        commandList->SetDescriptorHeaps(1, heaps);
        commandList->SetPipelineState(pso.Get());
        commandList->SetComputeRootConstantBufferView(0, sceneCB->GetGPUVirtualAddress());
        commandList->SetComputeRootDescriptorTable(1, srvUavHeap->GetGPUDescriptorHandleForHeapStart());
        D3D12_GPU_DESCRIPTOR_HANDLE uavGpu = srvUavHeap->GetGPUDescriptorHandleForHeapStart();
        uavGpu.ptr += descriptorSize;
        commandList->SetComputeRootDescriptorTable(2, uavGpu);

        commandList->Dispatch((kWidth + 7) / 8, (kHeight + 7) / 8, 1);

        D3D12_RESOURCE_BARRIER barrier{};
        barrier.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION;
        barrier.Flags = D3D12_RESOURCE_BARRIER_FLAG_NONE;
        barrier.Transition.pResource = outputTexture.Get();
        barrier.Transition.Subresource = D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES;
        barrier.Transition.StateBefore = D3D12_RESOURCE_STATE_UNORDERED_ACCESS;
        barrier.Transition.StateAfter = D3D12_RESOURCE_STATE_COPY_SOURCE;
        commandList->ResourceBarrier(1, &barrier);

        D3D12_TEXTURE_COPY_LOCATION src{};
        src.pResource = outputTexture.Get();
        src.Type = D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX;
        src.SubresourceIndex = 0;

        D3D12_TEXTURE_COPY_LOCATION dst{};
        dst.pResource = readbackBuffer.Get();
        dst.Type = D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT;
        dst.PlacedFootprint = footprint;

        commandList->CopyTextureRegion(&dst, 0, 0, 0, &src, nullptr);

        ThrowIfFailed(commandList->Close(), "Close command list failed");

        ID3D12CommandList* lists[] = {commandList.Get()};
        queue->ExecuteCommandLists(1, lists);
        WaitForGpu(queue.Get(), fence.Get(), fenceEvent, fenceValue);

        std::vector<uint8_t> pixels(kWidth * kHeight * 4);
        void* mapped = nullptr;
        ThrowIfFailed(readbackBuffer->Map(0, nullptr, &mapped), "Map readback failed");

        uint8_t* srcData = static_cast<uint8_t*>(mapped);
        for (uint32_t y = 0; y < kHeight; ++y)
        {
            memcpy(&pixels[y * kWidth * 4], srcData + y * footprint.Footprint.RowPitch, kWidth * 4);
        }
        readbackBuffer->Unmap(0, nullptr);

        SaveAsPPM(L"pathtrace_output.ppm", pixels, kWidth, kHeight);
        std::wcout << L"Path tracing complete. Output saved to pathtrace_output.ppm\n";

        CloseHandle(fenceEvent);
        return 0;
    }
    catch (const std::exception& ex)
    {
        std::cerr << "Error: " << ex.what() << "\n";
        return 1;
    }
}
