struct Sphere
{
    float3 center;
    float radius;

    float3 albedo;
    uint materialType; // 0 = diffuse, 1 = metal, 2 = dielectric, 3 = emissive

    float fuzz;
    float ior;
    float3 emission;
    float _pad0;
};

struct SceneCB
{
    uint width;
    uint height;
    uint frameIndex;
    uint sphereCount;

    float3 cameraPos;
    float _pad1;
    float3 cameraForward;
    float _pad2;
    float3 cameraRight;
    float _pad3;
    float3 cameraUp;
    float _pad4;

    float3 pointLightPosition;
    float pointLightIntensity;
    float3 pointLightColor;
    float ambientStrength;

    float3 directionalLightDirection;
    float directionalIntensity;
    float3 directionalLightColor;
    float _pad5;
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

float3 RandomUnitVector(inout uint rng)
{
    return normalize(RandomInUnitSphere(rng));
}

bool HitSphere(float3 rayOrigin, float3 rayDir, Sphere sphere, float tMin, float tMax,
    out float t, out float3 normal, out Sphere hitSphere)
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
        hitSphere = (Sphere)0;
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
            hitSphere = (Sphere)0;
            return false;
        }
    }

    t = root;
    float3 hitPoint = rayOrigin + t * rayDir;
    normal = normalize(hitPoint - sphere.center);
    hitSphere = sphere;
    return true;
}

bool TraceScene(float3 rayOrigin, float3 rayDir,
    out float tHit, out float3 normal, out Sphere hitSphere)
{
    tHit = 1e30;
    bool hitAnything = false;
    normal = 0.0;
    hitSphere = (Sphere)0;

    [loop]
    for (uint i = 0; i < gScene.sphereCount; ++i)
    {
        float t;
        float3 n;
        Sphere s;
        if (HitSphere(rayOrigin, rayDir, gSpheres[i], 0.001, tHit, t, n, s))
        {
            hitAnything = true;
            tHit = t;
            normal = n;
            hitSphere = s;
        }
    }

    return hitAnything;
}

float3 SkyColor(float3 dir)
{
    float t = 0.5 * (dir.y + 1.0);
    return lerp(float3(0.02, 0.03, 0.05), float3(0.55, 0.72, 1.0), t);
}

float Schlick(float cosine, float refIdx)
{
    float r0 = (1.0 - refIdx) / (1.0 + refIdx);
    r0 = r0 * r0;
    return r0 + (1.0 - r0) * pow(1.0 - cosine, 5.0);
}

bool RefractDir(float3 v, float3 n, float etaRatio, out float3 refracted)
{
    float cosTheta = min(dot(-v, n), 1.0);
    float3 rOutPerp = etaRatio * (v + cosTheta * n);
    float k = 1.0 - dot(rOutPerp, rOutPerp);
    if (k < 0.0)
    {
        refracted = 0.0;
        return false;
    }

    float3 rOutParallel = -sqrt(k) * n;
    refracted = rOutPerp + rOutParallel;
    return true;
}

float3 EstimateDirectLighting(float3 position, float3 normal, float3 albedo)
{
    float3 lighting = albedo * gScene.ambientStrength;

    float3 toPoint = gScene.pointLightPosition - position;
    float distSq = max(dot(toPoint, toPoint), 0.001);
    float3 pointDir = normalize(toPoint);
    float nDotL = max(dot(normal, pointDir), 0.0);
    lighting += albedo * gScene.pointLightColor * gScene.pointLightIntensity * (nDotL / distSq);

    float3 dirLightDir = normalize(-gScene.directionalLightDirection);
    float nDotDir = max(dot(normal, dirLightDir), 0.0);
    lighting += albedo * gScene.directionalLightColor * (nDotDir * gScene.directionalIntensity);

    return lighting;
}

[numthreads(8, 8, 1)]
void main(uint3 dispatchThreadId : SV_DispatchThreadID)
{
    if (dispatchThreadId.x >= gScene.width || dispatchThreadId.y >= gScene.height)
    {
        return;
    }

    uint seed = dispatchThreadId.x + dispatchThreadId.y * gScene.width + gScene.frameIndex * 9781;

    float2 jitter = float2(Random(seed), Random(seed));
    float2 uv = (float2(dispatchThreadId.xy) + jitter) / float2(gScene.width, gScene.height);
    uv = uv * 2.0 - 1.0;
    uv.x *= (float)gScene.width / (float)gScene.height;

    float3 origin = gScene.cameraPos;
    float3 direction = normalize(gScene.cameraForward + uv.x * gScene.cameraRight + uv.y * gScene.cameraUp);

    float3 throughput = 1.0;
    float3 radiance = 0.0;

    [loop]
    for (int bounce = 0; bounce < 6; ++bounce)
    {
        float t;
        float3 normal;
        Sphere hitObj;

        if (!TraceScene(origin, direction, t, normal, hitObj))
        {
            radiance += throughput * SkyColor(direction);
            break;
        }

        float3 hitPos = origin + direction * t;

        if (hitObj.materialType == 3)
        {
            radiance += throughput * hitObj.emission;
            break;
        }

        radiance += throughput * EstimateDirectLighting(hitPos + normal * 0.001, normal, hitObj.albedo);

        if (hitObj.materialType == 1)
        {
            float3 reflected = reflect(direction, normal);
            direction = normalize(reflected + hitObj.fuzz * RandomInUnitSphere(seed));
            throughput *= hitObj.albedo;
        }
        else if (hitObj.materialType == 2)
        {
            float refractionRatio = dot(direction, normal) > 0.0 ? hitObj.ior : (1.0 / hitObj.ior);
            float3 outwardNormal = dot(direction, normal) > 0.0 ? -normal : normal;
            float cosTheta = min(dot(-direction, outwardNormal), 1.0);
            float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));

            bool cannotRefract = refractionRatio * sinTheta > 1.0;
            float reflectProb = Schlick(cosTheta, refractionRatio);

            float3 nextDir;
            if (cannotRefract || Random(seed) < reflectProb)
            {
                nextDir = reflect(direction, outwardNormal);
            }
            else
            {
                RefractDir(direction, outwardNormal, refractionRatio, nextDir);
            }

            direction = normalize(nextDir);
            throughput *= hitObj.albedo;
        }
        else
        {
            float3 scatterDir = normal + RandomUnitVector(seed);
            direction = normalize(scatterDir);
            throughput *= hitObj.albedo;
        }

        origin = hitPos + normal * 0.001;

        float p = max(throughput.r, max(throughput.g, throughput.b));
        if (bounce > 2)
        {
            if (Random(seed) > p)
            {
                break;
            }
            throughput /= max(p, 0.001);
        }
    }

    float3 color = saturate(radiance);
    color = pow(color, 1.0 / 2.2);
    gOutput[dispatchThreadId.xy] = float4(color, 1.0);
}
