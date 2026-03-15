struct Sphere
{
    float3 center;
    float radius;
    float3 albedo;
    uint materialType; // 0 = diffuse, 1 = metal
    float fuzz;
    float2 padding;
};

struct SceneCB
{
    uint width;
    uint height;
    uint frameIndex;
    uint sphereCount;

    float3 cameraPos;
    float _pad0;
    float3 cameraForward;
    float _pad1;
    float3 cameraRight;
    float _pad2;
    float3 cameraUp;
    float _pad3;

    float3 lightPosition;
    float lightIntensity;
    float3 lightColor;
    float _pad4;
};

ConstantBuffer<SceneCB> gScene : register(b0);
StructuredBuffer<Sphere> gSpheres : register(t0);
RWTexture2D<float4> gOutput : register(u0);

uint Hash(uint x)
{
    x ^= x >> 16;
    x *= 0x7feb352d;
    x ^= x >> 15;
    x *= 0x846ca68b;
    x ^= x >> 16;
    return x;
}

float Random(inout uint state)
{
    state = Hash(state);
    return (state & 0x00FFFFFF) / 16777216.0;
}

float3 RandomInUnitSphere(inout uint rng)
{
    float3 p;
    do
    {
        p = float3(Random(rng), Random(rng), Random(rng)) * 2.0 - 1.0;
    } while (dot(p, p) >= 1.0);
    return p;
}

bool HitSphere(float3 rayOrigin, float3 rayDir, Sphere sphere, float tMin, float tMax,
               out float t, out float3 normal, out uint materialType, out float3 albedo, out float fuzz)
{
    float3 oc = rayOrigin - sphere.center;
    float a = dot(rayDir, rayDir);
    float halfB = dot(oc, rayDir);
    float c = dot(oc, oc) - sphere.radius * sphere.radius;
    float discriminant = halfB * halfB - a * c;

    if (discriminant < 0.0)
    {
        t = 0.0;
        normal = 0.0;
        materialType = 0;
        albedo = 0.0;
        fuzz = 0.0;
        return false;
    }

    float sqrtD = sqrt(discriminant);
    float root = (-halfB - sqrtD) / a;

    if (root < tMin || root > tMax)
    {
        root = (-halfB + sqrtD) / a;
        if (root < tMin || root > tMax)
        {
            t = 0.0;
            normal = 0.0;
            materialType = 0;
            albedo = 0.0;
            fuzz = 0.0;
            return false;
        }
    }

    t = root;
    float3 hitPoint = rayOrigin + t * rayDir;
    normal = normalize(hitPoint - sphere.center);
    materialType = sphere.materialType;
    albedo = sphere.albedo;
    fuzz = sphere.fuzz;
    return true;
}

bool TraceScene(float3 rayOrigin, float3 rayDir,
                out float tHit, out float3 normal, out uint materialType, out float3 albedo, out float fuzz)
{
    tHit = 1e30;
    bool hitAnything = false;
    normal = 0.0;
    materialType = 0;
    albedo = 0.0;
    fuzz = 0.0;

    [loop]
    for (uint i = 0; i < gScene.sphereCount; ++i)
    {
        float t;
        float3 n;
        uint mt;
        float3 c;
        float f;
        if (HitSphere(rayOrigin, rayDir, gSpheres[i], 0.001, tHit, t, n, mt, c, f))
        {
            hitAnything = true;
            tHit = t;
            normal = n;
            materialType = mt;
            albedo = c;
            fuzz = f;
        }
    }

    return hitAnything;
}

float3 SkyColor(float3 dir)
{
    float t = 0.5 * (dir.y + 1.0);
    return lerp(float3(1.0, 1.0, 1.0), float3(0.5, 0.7, 1.0), t);
}

[numthreads(8, 8, 1)]
void main(uint3 dispatchThreadId : SV_DispatchThreadID)
{
    if (dispatchThreadId.x >= gScene.width || dispatchThreadId.y >= gScene.height)
    {
        return;
    }

    uint seed = dispatchThreadId.x + dispatchThreadId.y * gScene.width + gScene.frameIndex * 9781;

    float2 uv = (float2(dispatchThreadId.xy) + float2(Random(seed), Random(seed))) /
                float2(gScene.width, gScene.height);
    uv = uv * 2.0 - 1.0;
    uv.x *= (float)gScene.width / (float)gScene.height;

    float3 origin = gScene.cameraPos;
    float3 direction = normalize(gScene.cameraForward + uv.x * gScene.cameraRight + uv.y * gScene.cameraUp);

    float3 throughput = 1.0;
    float3 radiance = 0.0;

    [unroll]
    for (int bounce = 0; bounce < 4; ++bounce)
    {
        float t;
        float3 normal;
        uint materialType;
        float3 albedo;
        float fuzz;

        if (!TraceScene(origin, direction, t, normal, materialType, albedo, fuzz))
        {
            radiance += throughput * SkyColor(direction);
            break;
        }

        float3 hitPos = origin + direction * t;
        float3 toLight = gScene.lightPosition - hitPos;
        float distSq = max(dot(toLight, toLight), 0.001);
        float3 lightDir = normalize(toLight);
        float nDotL = max(dot(normal, lightDir), 0.0);
        radiance += throughput * albedo * gScene.lightColor * gScene.lightIntensity * (nDotL / distSq);

        if (materialType == 1)
        {
            float3 reflected = reflect(direction, normal);
            direction = normalize(reflected + fuzz * RandomInUnitSphere(seed));
            throughput *= albedo;
        }
        else
        {
            direction = normalize(normal + RandomInUnitSphere(seed));
            throughput *= albedo;
        }

        origin = hitPos + normal * 0.001;
    }

    float3 color = saturate(radiance);
    color = pow(color, 1.0 / 2.2); // gamma correction

    gOutput[dispatchThreadId.xy] = float4(color, 1.0);
}
