# Torque Lab Simulator

Yes, create AUTOMECH Prototype 0.1 and start with the Three.js coupe and engine bay.

Build AUTOMECH Prototype 0.1 based on the attached Full Game Development Plan:
- Three.js 3D sports coupe and engine bay with interactive camera controls (rotate, zoom, pan, focus on engine components).
- Modular engine components with data-driven physical attributes (intake, camshaft, turbochargers, intercooler, injectors, exhaust, ECU tuning).
- Deterministic simulation core decoupled from rendering: volumetric efficiency (VE), boost curve, BMEP, torque, horsepower across the RPM rev range, thermal load, and reliability.
- Interactive Dyno Lab: live dyno runs with real-time torque/power curves, boost pressure, AFR, and exhaust gas temperatures.
- 5 engineering challenges with budget, reliability, and power goals.
- Local save system and credits economy.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7475e29e-b8d0-49a3-a57f-23c7f7417794).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
