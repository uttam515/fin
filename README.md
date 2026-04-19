# 🎓 AI Academic Mentor — Learning Through Projects

An AI-powered platform that analyzes a student's academic syllabus and generates a personalized skill-building roadmap while ensuring their CGPA stays above a target threshold.

The system helps students move from **theory-based learning to project-based learning**, enabling them to build real-world skills alongside their academic studies.

---

# 🚀 Problem

Many college students struggle with balancing **academic performance and skill development**.

Students often ask questions like:

- What subjects should I focus on to maintain my CGPA?
- Which skills should I develop for my dream career?
- How can I build projects while managing college workload?
- What should I learn next?

Traditional education systems provide **syllabus guidance but not skill-building direction**, leaving students confused about how to prepare for real-world careers.

---

# 💡 Solution

We built an **AI-powered Academic Mentor** that helps students plan their learning journey.

The system analyzes:

- Academic syllabus
- Current CGPA
- Target CGPA
- Career goals
- Preferred technologies

Based on this data, the platform generates:

- Personalized skill roadmap
- Project-based learning suggestions
- Balanced weekly study plan

This ensures students can **maintain academic performance while building real-world skills and projects.**

---

# ✨ Key Features

## 📚 Syllabus Analysis
Students upload or enter their academic syllabus.

The AI analyzes:
- Important subjects
- Difficult topics
- Subjects requiring higher focus

---

## 🎯 Goal-Based Planning
Students enter their **career goals** such as:

- AI Engineer
- Software Developer
- Web Developer
- Data Scientist

The system recommends **skills aligned with their target career path.**

---

## 🛠 Learning Through Projects
Instead of only suggesting topics, the platform encourages **learning by building projects.**

Example:

| Topic | Suggested Project |
|------|-------------------|
| Data Structures | Pathfinding Visualizer |
| Web Development | Personal Portfolio Website |
| Machine Learning | Movie Recommendation System |

Students can build these projects and add them to their **GitHub portfolio or resume**.

---

## 📅 Smart Weekly Planner

The AI generates a **balanced weekly schedule** that includes:

- Academic study
- Skill learning
- Project building

This prevents students from **neglecting their CGPA while learning new skills.**

---

# 🧠 How It Works

1️⃣ Student enters:

- Academic syllabus  
- Current CGPA  
- Target CGPA  
- Career goals  
- Technologies they want to learn  

2️⃣ AI analyzes syllabus difficulty and workload.

3️⃣ Based on the user's goals, the system recommends:

- Skills to develop
- Projects to build

4️⃣ A **weekly learning roadmap** is generated.

---

# 🛠 Tech Stack

## Frontend
- HTML
- CSS
- JavaScript

## Backend
- Python
- FastAPI

## AI Layer
- Groq API (LLM)

## Tools
- GitHub (Version Control)
- LocalTunnel (Mobile demo access)

---

# 📊 Example Output

**Student Input**

Current CGPA: 7.2  
Target CGPA: 8.0  
Goal: AI Engineer  

**Generated Plan**

Monday – Study Data Structures  
Tuesday – Practice Python  
Wednesday – Study Operating Systems  
Thursday – Learn Machine Learning basics  
Friday – Build ML mini project  
Saturday – Continue project development  
Sunday – Review concepts + GitHub commits

---

# 📱 Demo

To access the project from another device:

```bash
npx localtunnel --port 8000