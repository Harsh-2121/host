#include <windows.h>
#include <wrl/client.h>
#include <d3d12.h>
#include <dxgi1_6.h>
#include <d3dcompiler.h>

#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace
{
    constexpr uint32_t kWidth = 1280;
    constexpr uint32_t kHeight = 720;

    struct Float3
    {
        float x;
        float y;
        float z;
    };

    Float3 operator+(const Float3& a, const Float3& b) { return {a.x + b.x, a.y + b.y, a.z + b.z}; }
    Float3 operator-(const Float3& a, const Float3& b) { return {a.x - b.x, a.y - b.y, a.z - b.z}; }
    Float3 operator*(const Float3& a, float s) { return {a.x * s, a.y * s, a.z * s}; }
    Float3 operator/(const Float3& a, float s) { return {a.x / s, a.y / s, a.z / s}; }

    float Dot(const Float3& a, const Float3& b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    float Length(const Float3& v) { return std::sqrt(Dot(v, v)); }

    Float3 Normalize(const Float3& v)
    {
        float len = Length(v);
        if (len <= 1e-6f)
        {
            return {0.0f, 0.0f, 0.0f};
        }
        return v / len;
    }

    struct alignas(16) SphereGPU
    {
        float center[3];
        float radius;

        float albedo[3];
        uint32_t materialType;

        float fuzz;
        float ior;
        float emission[3];
        float pad0;
    };

    struct alignas(16) SceneConstants
    {
        uint32_t width;
        uint32_t height;
        uint32_t frameIndex;
        uint32_t sphereCount;

        float cameraPos[3];
        float pad1;
        float cameraForward[3];
        float pad2;
        float cameraRight[3];
        float pad3;
        float cameraUp[3];
        float pad4;

        float pointLightPosition[3];
        float pointLightIntensity;
        float pointLightColor[3];
        float ambientStrength;

        float directionalLightDirection[3];
        float directionalIntensity;
        float directionalLightColor[3];
        float pad5;
    };

    struct PhysicsSphere
    {
        Float3 position;
        Float3 velocity;
        float radius;
        float inverseMass;
        float restitution;
        SphereGPU render;
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

    void SimulatePhysics(std::vector<PhysicsSphere>& bodies, float durationSeconds)
    {
        const Float3 gravity = {0.0f, -9.81f, 0.0f};
        const float timeStep = 1.0f / 120.0f;
        const int steps = static_cast<int>(durationSeconds / timeStep);

        const float arenaHalfX = 5.0f;
        const float arenaHalfZ = 7.0f;

        for (int step = 0; step < steps; ++step)
        {
            for (auto& body : bodies)
            {
                if (body.inverseMass > 0.0f)
                {
                    body.velocity = body.velocity + gravity * timeStep;
                    body.position = body.position + body.velocity * timeStep;

                    if (body.position.y < body.radius)
                    {
                        body.position.y = body.radius;
                        body.velocity.y = -body.velocity.y * body.restitution;
                        body.velocity.x *= 0.92f;
                        body.velocity.z *= 0.92f;
                    }

                    if (body.position.x < -arenaHalfX + body.radius)
                    {
                        body.position.x = -arenaHalfX + body.radius;
                        body.velocity.x = -body.velocity.x * body.restitution;
                    }
                    if (body.position.x > arenaHalfX - body.radius)
                    {
                        body.position.x = arenaHalfX - body.radius;
                        body.velocity.x = -body.velocity.x * body.restitution;
                    }
                    if (body.position.z < -arenaHalfZ + body.radius)
                    {
                        body.position.z = -arenaHalfZ + body.radius;
                        body.velocity.z = -body.velocity.z * body.restitution;
                    }
                    if (body.position.z > arenaHalfZ - body.radius)
                    {
                        body.position.z = arenaHalfZ - body.radius;
                        body.velocity.z = -body.velocity.z * body.restitution;
                    }
                }
            }

            for (size_t i = 0; i < bodies.size(); ++i)
            {
                for (size_t j = i + 1; j < bodies.size(); ++j)
                {
                    if (bodies[i].inverseMass <= 0.0f && bodies[j].inverseMass <= 0.0f)
                    {
                        continue;
                    }

                    Float3 delta = bodies[j].position - bodies[i].position;
                    float dist = Length(delta);
                    const float minDist = bodies[i].radius + bodies[j].radius;
                    if (dist <= 1e-5f || dist >= minDist)
                    {
                        continue;
                    }

                    Float3 normal = delta / dist;
                    float penetration = minDist - dist;

                    float invMassSum = bodies[i].inverseMass + bodies[j].inverseMass;
                    if (invMassSum <= 0.0f)
                    {
                        continue;
                    }

                    bodies[i].position = bodies[i].position - normal * (penetration * (bodies[i].inverseMass / invMassSum));
                    bodies[j].position = bodies[j].position + normal * (penetration * (bodies[j].inverseMass / invMassSum));

                    Float3 relativeVelocity = bodies[j].velocity - bodies[i].velocity;
                    float velAlongNormal = Dot(relativeVelocity, normal);
                    if (velAlongNormal > 0.0f)
                    {
                        continue;
                    }

                    float restitution = (bodies[i].restitution + bodies[j].restitution) * 0.5f;
                    float impulseScalar = -(1.0f + restitution) * velAlongNormal / invMassSum;
                    Float3 impulse = normal * impulseScalar;

                    bodies[i].velocity = bodies[i].velocity - impulse * bodies[i].inverseMass;
                    bodies[j].velocity = bodies[j].velocity + impulse * bodies[j].inverseMass;
                }
            }
        }

        for (auto& body : bodies)
        {
            body.render.center[0] = body.position.x;
            body.render.center[1] = body.position.y;
            body.render.center[2] = body.position.z;
            body.render.radius = body.radius;
        }
    }

    SphereGPU MakeSphere(Float3 center, float radius, Float3 albedo, uint32_t materialType, float fuzz, float ior, Float3 emission)
    {
        SphereGPU sphere{};
        sphere.center[0] = center.x;
        sphere.center[1] = center.y;
        sphere.center[2] = center.z;
        sphere.radius = radius;

        sphere.albedo[0] = albedo.x;
        sphere.albedo[1] = albedo.y;
        sphere.albedo[2] = albedo.z;
        sphere.materialType = materialType;

        sphere.fuzz = fuzz;
        sphere.ior = ior;
        sphere.emission[0] = emission.x;
        sphere.emission[1] = emission.y;
        sphere.emission[2] = emission.z;
        sphere.pad0 = 0.0f;
        return sphere;
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
        ThrowIfFailed(D3DCompileFromFile(
            L"pathtracer.hlsl",
            nullptr,
            D3D_COMPILE_STANDARD_FILE_INCLUDE,
            "main",
            "cs_5_1",
            D3DCOMPILE_ENABLE_STRICTNESS,
            0,
            &csBlob,
            &errorBlob), "Shader compilation failed");

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

        params[1].ParameterType = D3D12_ROOT_PARAMETER_TYPE_DESCRIPTOR_TABLE;
        params[1].DescriptorTable.NumDescriptorRanges = 1;
        params[1].DescriptorTable.pDescriptorRanges = &ranges[0];

        params[2].ParameterType = D3D12_ROOT_PARAMETER_TYPE_DESCRIPTOR_TABLE;
        params[2].DescriptorTable.NumDescriptorRanges = 1;
        params[2].DescriptorTable.pDescriptorRanges = &ranges[1];

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

        std::vector<PhysicsSphere> dynamicBodies = {
            {{-2.0f, 4.5f, 2.2f}, {2.6f, 0.0f, 1.0f}, 0.55f, 1.0f, 0.65f, MakeSphere({0,0,0}, 0.55f, {0.88f, 0.25f, 0.2f}, 0, 0.0f, 1.0f, {0,0,0})},
            {{1.2f, 5.8f, 4.5f}, {-1.2f, 0.0f, -0.8f}, 0.7f, 1.0f, 0.70f, MakeSphere({0,0,0}, 0.7f, {0.15f, 0.45f, 0.92f}, 0, 0.0f, 1.0f, {0,0,0})},
            {{0.5f, 7.0f, 2.7f}, {-0.8f, 0.0f, 0.2f}, 0.62f, 1.0f, 0.80f, MakeSphere({0,0,0}, 0.62f, {0.95f, 0.95f, 0.98f}, 1, 0.02f, 1.0f, {0,0,0})},
            {{2.5f, 6.2f, 3.4f}, {-1.8f, 0.0f, -0.2f}, 0.5f, 1.0f, 0.72f, MakeSphere({0,0,0}, 0.5f, {0.98f, 0.99f, 1.0f}, 2, 0.0f, 1.45f, {0,0,0})}
        };

        SimulatePhysics(dynamicBodies, 4.0f);

        std::vector<SphereGPU> spheres;
        spheres.reserve(16);

        spheres.push_back(MakeSphere({0.0f, -1000.0f, 0.0f}, 1000.0f, {0.68f, 0.69f, 0.72f}, 0, 0.0f, 1.0f, {0,0,0}));
        spheres.push_back(MakeSphere({-1005.0f, 2.0f, 0.0f}, 1000.0f, {0.62f, 0.52f, 0.48f}, 0, 0.0f, 1.0f, {0,0,0}));
        spheres.push_back(MakeSphere({1005.0f, 2.0f, 0.0f}, 1000.0f, {0.45f, 0.5f, 0.62f}, 0, 0.0f, 1.0f, {0,0,0}));
        spheres.push_back(MakeSphere({0.0f, 2.0f, 1010.0f}, 1000.0f, {0.56f, 0.58f, 0.52f}, 0, 0.0f, 1.0f, {0,0,0}));
        spheres.push_back(MakeSphere({0.0f, 12.0f, 0.0f}, 1000.0f, {0.7f, 0.7f, 0.7f}, 0, 0.0f, 1.0f, {0,0,0}));

        for (const auto& body : dynamicBodies)
        {
            spheres.push_back(body.render);
        }

        spheres.push_back(MakeSphere({0.0f, 8.5f, 3.0f}, 0.65f, {1.0f, 1.0f, 1.0f}, 3, 0.0f, 1.0f, {10.0f, 9.6f, 8.8f}));
        spheres.push_back(MakeSphere({-3.2f, 1.0f, 6.2f}, 1.0f, {0.85f, 0.78f, 0.22f}, 1, 0.12f, 1.0f, {0,0,0}));
        spheres.push_back(MakeSphere({2.8f, 1.1f, 5.8f}, 1.1f, {0.95f, 0.95f, 1.0f}, 2, 0.0f, 1.52f, {0,0,0}));

        SceneConstants scene{};
        scene.width = kWidth;
        scene.height = kHeight;
        scene.frameIndex = 42;
        scene.sphereCount = static_cast<uint32_t>(spheres.size());

        scene.cameraPos[0] = 0.0f; scene.cameraPos[1] = 3.2f; scene.cameraPos[2] = -10.2f;
        Float3 forward = Normalize({0.0f, -0.15f, 1.0f});
        scene.cameraForward[0] = forward.x; scene.cameraForward[1] = forward.y; scene.cameraForward[2] = forward.z;
        scene.cameraRight[0] = 1.0f; scene.cameraRight[1] = 0.0f; scene.cameraRight[2] = 0.0f;
        scene.cameraUp[0] = 0.0f; scene.cameraUp[1] = 1.0f; scene.cameraUp[2] = 0.0f;

        scene.pointLightPosition[0] = -1.4f; scene.pointLightPosition[1] = 8.0f; scene.pointLightPosition[2] = 1.8f;
        scene.pointLightIntensity = 170.0f;
        scene.pointLightColor[0] = 1.0f; scene.pointLightColor[1] = 0.96f; scene.pointLightColor[2] = 0.88f;
        scene.ambientStrength = 0.02f;

        scene.directionalLightDirection[0] = -0.4f; scene.directionalLightDirection[1] = -1.0f; scene.directionalLightDirection[2] = -0.2f;
        scene.directionalIntensity = 0.5f;
        scene.directionalLightColor[0] = 0.65f; scene.directionalLightColor[1] = 0.72f; scene.directionalLightColor[2] = 1.0f;

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
        auto* srcData = static_cast<uint8_t*>(mapped);
        for (uint32_t y = 0; y < kHeight; ++y)
        {
            memcpy(&pixels[y * kWidth * 4], srcData + y * footprint.Footprint.RowPitch, kWidth * 4);
        }
        readbackBuffer->Unmap(0, nullptr);

        SaveAsPPM(L"pathtrace_output.ppm", pixels, kWidth, kHeight);
        std::wcout << L"Path tracing with lighting + physics complete. Output saved to pathtrace_output.ppm\n";

        CloseHandle(fenceEvent);
        return 0;
    }
    catch (const std::exception& ex)
    {
        std::cerr << "Error: " << ex.what() << "\n";
        return 1;
    }
}
