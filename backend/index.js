const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware Setup
app.use(cors());
app.use(express.json());

// 1. DATABASE SCHEMA & MODEL
const CandidateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    skills: { type: [String], required: true },
    experience: { type: Number, required: true },
    projects: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

const Candidate = mongoose.model('Candidate', CandidateSchema);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✓ MongoDB Connected Successfully'))
    .catch((err) => {
        console.error('✗ MongoDB Connection Error:', err.message);
    });

// API ENDPOINTS

// 1. Add Candidate
app.post('/api/candidates', async (req, res) => {
    try {
        const { name, email, skills, experience, projects } = req.body;
        if (!name || !email || !skills || !experience) {
            return res.status(400).json({ message: "All fields are required." });
        }
        const newCandidate = new Candidate({ name, email, skills, experience, projects });
        await newCandidate.save();
        res.status(201).json({ message: "Candidate added successfully!", candidate: newCandidate });
    } catch (error) {
        res.status(500).json({ message: "Error adding candidate", error: error.message });
    }
});

// 2. Get All Candidates
app.get('/api/candidates', async (req, res) => {
    try {
        const candidates = await Candidate.find();
        res.status(200).json(candidates);
    } catch (error) {
        res.status(500).json({ message: "Error fetching candidates", error: error.message });
    }
});

// 3. Shortlist Candidates (Basic Matching Logic)
app.post('/api/match', async (req, res) => {
    try {
        const { requiredSkills, minExperience } = req.body;
        if (!requiredSkills || !Array.isArray(requiredSkills)) {
            return res.status(400).json({ message: "requiredSkills must be an array." });
        }

        const candidates = await Candidate.find();

        const matchedCandidates = candidates.map(candidate => {
            const matchedSkills = candidate.skills.filter(skill =>
                requiredSkills.some(reqSkill => reqSkill.toLowerCase() === skill.toLowerCase())
            );
            const score = requiredSkills.length > 0 ? (matchedSkills.length / requiredSkills.length) : 0;

            return {
                _id: candidate._id,
                name: candidate.name,
                email: candidate.email,
                skills: candidate.skills,
                experience: candidate.experience,
                projects: candidate.projects,
                matchedSkills: matchedSkills,
                matchScore: Math.round(score * 100)
            };
        });

        const filteredAndSorted = matchedCandidates
            .filter(c => c.experience >= (minExperience || 0))
            .sort((a, b) => b.matchScore - a.matchScore);

        res.status(200).json(filteredAndSorted);
    } catch (error) {
        res.status(500).json({ message: "Error performing basic match", error: error.message });
    }
});

// 4. AI-Based Shortlisting (OpenRouter AI)
app.post('/api/ai/shortlist', async (req, res) => {
    try {
        const { requiredSkills, minExperience } = req.body;
        const candidates = await Candidate.find();
        
        if (candidates.length === 0) {
            return res.status(400).json({ message: "No candidates found." });
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ message: "OpenRouter API Key is missing." });
        }

        const jobDescriptionText = `Job requires: ${requiredSkills.join(', ')} (${minExperience}+ years experience)`;
        const candidatesText = candidates.map((c, index) => 
            `${index + 1}. ${c.name} - Skills: [${c.skills.join(', ')}] - Experience: ${c.experience} years`
        ).join('\n');

        const promptContent = `${jobDescriptionText}\n\nCandidates:\n${candidatesText}\n\nRank candidates and explain why. Output format MUST be strictly a raw JSON array of objects without any markdown boxes or formatting. Example: [{"name": "Name", "matchScore": 90, "aiExplanation": "Reason"}]`;

        const { default: fetch } = await import('node-fetch');
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash:free",
                messages: [{ role: "user", content: promptContent }]
            })
        });

        const aiData = await response.json();
        let aiMessageContent = aiData.choices[0].message.content.trim();

        if (aiMessageContent.startsWith("```")) {
            aiMessageContent = aiMessageContent.replace(/```json|```/g, '').trim();
        }

        const structuredAiRanking = JSON.parse(aiMessageContent);
        res.status(200).json({ message: "Success", ranking: structuredAiRanking });
    } catch (error) {
        res.status(500).json({ message: "AI Match Error", error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
});