# DirectX 12 Path Tracing Simulation

This sample provides a more complete **DirectX 12 compute-based path tracer** with:

- A closed arena-style scene (floor, walls, and ceiling).
- Multiple material types: diffuse, metal (reflective), dielectric (glass), and emissive.
- Hybrid lighting: emissive sphere, point light, and directional fill light.
- A lightweight rigid-body **sphere physics simulation** (gravity + collisions) to generate a physically plausible final layout before rendering.

The renderer writes one path-traced frame to `pathtrace_output.ppm`.

## Scene setup

`src/main.cpp` builds a complete scene:

- Static architecture spheres that form a room.
- Dynamic spheres simulated for ~4 seconds with gravity and sphere-sphere collisions.
- A reflective metallic hero sphere and a glass sphere.
- An emissive sphere used as an area-like glow source.

## Build (Windows)

Use Visual Studio 2022 (or newer) with Windows SDK:

```powershell
cd dx12_path_tracer
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

## Run

```powershell
cd dx12_path_tracer/build/Release
./dx12_path_tracer.exe
```

Expected output:

- `pathtrace_output.ppm` in the current directory.
