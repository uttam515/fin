Structural Health Index (SHI)

Structural Health Index (SHI) is a real-time monitoring system that detects early signs of structural damage in bridges and buildings using vibration analysis and signal processing.

Instead of relying only on manual inspections, the system continuously monitors natural vibrations such as wind, traffic, and footsteps to detect changes in structural behavior.

The core idea is Structural Fingerprinting using Resonant Frequency Analysis, which allows early detection of structural degradation.

⸻

Problem

Traditional structural inspection methods have several limitations:
	•	Inspections happen only once every few months or years
	•	Hidden damage may not be visible
	•	Bridges or buildings sometimes need to be closed for testing
	•	Specialized equipment and engineers are required

Small structural issues often start as minor stiffness changes that cannot be seen visually.

By the time visible damage appears, repairs become expensive and dangerous.

⸻

Solution

Structural Health Index continuously monitors structures using passive vibration sensing.

The system:
	1.	Collects vibration data from sensors
	2.	Processes signals using signal processing techniques
	3.	Extracts the resonant frequency of the structure
	4.	Tracks changes in the structural fingerprint over time
	5.	Detects anomalies that may indicate structural damage

⸻

Core Idea

Every structure has a natural resonant frequency determined by its stiffness.

Frequency is proportional to the square root of stiffness.

If the structure develops cracks, corrosion, or loose joints:
	•	Stiffness decreases
	•	Resonant frequency decreases

By tracking these frequency shifts, the system can detect structural problems early.

⸻

System Pipeline

Vibration Sensors
↓
Data Collection
↓
Signal Preprocessing (Hanning Window)
↓
FFT (Fast Fourier Transform)
↓
Frequency Spectrum Analysis
↓
Resonant Frequency Detection
↓
RMS Intensity Calculation
↓
Structural Health Dashboard

⸻

Key Concepts

Resonant Frequency

The natural vibration frequency of a structure. Changes indicate structural changes.

Operational Modal Analysis (OMA)

Monitoring structures using natural operational vibrations without shutting them down.

Fast Fourier Transform (FFT)

Converts vibration signals from the time domain to the frequency domain.

Hanning Window

A preprocessing technique used to reduce noise before applying FFT.

Spectral Density

Displays vibration energy across frequencies and acts as a structural fingerprint.

RMS (Root Mean Square)

Measures the overall intensity of vibration.

Nyquist Frequency

The maximum detectable frequency based on the sampling rate.

Nyquist Frequency = Sampling Rate / 2

⸻

Features
	•	Real-time vibration monitoring
	•	Structural fingerprint detection
	•	Frequency shift tracking
	•	FFT-based signal processing
	•	Live dashboard visualization
	•	Early warning system for structural degradation
	•	Mobile-accessible monitoring interface

⸻

Tech Stack

Backend
	•	Python
	•	FastAPI
	•	NumPy
	•	SciPy

Signal Processing
	•	FFT
	•	Hanning Window
	•	RMS Analysis

Frontend
	•	HTML
	•	CSS
	•	JavaScript
	•	Chart.js or Plotly

Communication
	•	WebSockets for real-time updates

Deployment
	•	Localtunnel for remote access
	•	GitHub for version control

⸻

How It Works
	1.	Sensors capture vibration data from the structure.
	2.	Data is streamed to the backend server.
	3.	The signal is preprocessed to remove noise.
	4.	FFT extracts the frequency components.
	5.	The dominant resonant frequency is identified.
	6.	RMS calculates vibration intensity.
	7.	The dashboard visualizes structural health metrics.

If a frequency shift occurs, the system flags a potential structural issue.

⸻

Applications

Structural Health Index can be used for monitoring:
	•	Bridges
	•	Buildings
	•	Dams
	•	Stadiums
	•	Industrial structures
	•	Smart city infrastructure

⸻

Future Improvements
	•	AI-based anomaly detection
	•	Predictive maintenance models
	•	IoT sensor integration
	•	Multi-sensor modal analysis
	•	Cloud monitoring
	•	Digital twin integration

⸻

Hackathon Vision

Structural Health Index demonstrates how signal processing, IoT sensing, and real-time analytics can transform structural monitoring.

Instead of reactive inspections, infrastructure can become self-monitoring and predictive, improving safety and reducing maintenance costs.

⸻

License

MIT License
