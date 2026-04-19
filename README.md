# Structural Health Index from Passive Vibration Sensing

A real-time structural monitoring system that uses a **mobile phone accelerometer as a vibration sensor** to estimate the **structural health of buildings or bridges** by analyzing vibration frequencies.

The system streams vibration data from a **mobile device to a backend server using WebSockets**, performs **signal processing (FFT)**, and computes a **Structural Health Index (SHI)** indicating potential structural degradation.

---

# Problem

Infrastructure such as **bridges, buildings, and towers degrade silently over time** due to:

- Material fatigue  
- Micro-cracks  
- Loosened joints  
- Environmental stress  

Traditional structural monitoring systems require:

- Expensive calibrated sensors  
- Manual inspection by engineers  
- Complex installations  

This project demonstrates a **low-cost passive monitoring approach** using only a **smartphone accelerometer**.

---

# Solution

This project converts a **mobile phone into a vibration sensing device** and streams sensor data to a backend server where signal processing is performed.

The system:

1. Captures vibration using the **mobile accelerometer**
2. Streams data to a **Python backend via WebSockets**
3. Performs **Fast Fourier Transform (FFT)** to detect dominant frequencies
4. Compares frequency shifts with a baseline
5. Computes a **Structural Health Index**

This enables **continuous, low-cost monitoring of infrastructure health**.

---

# Features

- Real-time vibration monitoring  
- Mobile accelerometer as a sensor  
- Low-latency WebSocket data streaming  
- FFT-based vibration analysis  
- Structural Health Index computation  
- Live frequency visualization dashboard  

---

# Tech Stack

## Frontend
- HTML
- JavaScript
- WebSocket API
- DeviceMotion API

## Backend
- Python
- FastAPI
- WebSockets
- NumPy
- SciPy

## Networking
- LocalTunnel (HTTPS access for mobile testing)

## Visualization
- Chart.js / Plotly
