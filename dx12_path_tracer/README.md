# DirectX 12 Path Tracing Simulation

This sample adds a minimal **DirectX 12 compute-based path tracer** that renders:

- A ground sphere.
- Two diffuse spheres with different albedo colors.
- One reflective metallic sphere.
- A single point light source.

The renderer writes one path-traced frame to `pathtrace_output.ppm`.

## Scene setup

The sample scene is configured in `src/main.cpp`:

- **Light** at `(0, 5, 2)` with warm color and high intensity.
- **Spheres**:
  - Red diffuse sphere.
  - Green diffuse sphere.
  - Reflective metal sphere (`materialType = 1`, low `fuzz`).

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

You can open `.ppm` files in many image viewers (or convert with ImageMagick).
