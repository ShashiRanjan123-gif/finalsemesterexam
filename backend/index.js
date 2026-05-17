const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

/* =========================================
   MIDDLEWARES
========================================= */

app.use(cors());

app.use(express.json());

// Logger Middleware
app.use((req, res, next) => {
  console.log(
    `📌 ${req.method} ${req.url} - ${new Date().toLocaleString()}`
  );

  next();
});

/* =========================================
   DATABASE CONNECTION
========================================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((err) => {
    console.log("❌ MongoDB Error:", err.message);
  });

/* =========================================
   CANDIDATE SCHEMA
========================================= */

const CandidateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  skills: {
    type: [String],
    required: true,
  },

  experience: {
    type: Number,
    required: true,
  },

  projects: {
    type: String,
    default: "",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Candidate = mongoose.model(
  "Candidate",
  CandidateSchema
);

/* =========================================
   HOME ROUTE
========================================= */

app.get("/", (req, res) => {
  res.send(
    "🚀 Candidate Shortlisting API Running"
  );
});

/* =========================================
   ADD CANDIDATE API
========================================= */

app.post("/api/candidates", async (req, res) => {
  try {
    const {
      name,
      email,
      skills,
      experience,
      projects,
    } = req.body;

    // Validation
    if (
      !name ||
      !email ||
      !skills ||
      !experience
    ) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required",
      });
    }

    // Existing Candidate Check
    const existingCandidate =
      await Candidate.findOne({ email });

    if (existingCandidate) {
      return res.status(400).json({
        success: false,
        message:
          "Candidate already exists",
      });
    }

    // Create Candidate
    const newCandidate =
      await Candidate.create({
        name,
        email,
        skills,
        experience,
        projects,
      });

    res.status(201).json({
      success: true,
      message:
        "✅ Candidate Added Successfully",
      candidate: newCandidate,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* =========================================
   GET ALL CANDIDATES
========================================= */

app.get("/api/candidates", async (req, res) => {
  try {
    const candidates =
      await Candidate.find().sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      totalCandidates:
        candidates.length,
      candidates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* =========================================
   SEARCH CANDIDATES
========================================= */

app.get(
  "/api/search/:skill",
  async (req, res) => {
    try {
      const skill =
        req.params.skill;

      const candidates =
        await Candidate.find({
          skills: {
            $regex: new RegExp(
              skill,
              "i"
            ),
          },
        });

      res.status(200).json({
        success: true,
        total: candidates.length,
        candidates,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/* =========================================
   BASIC MATCHING API
========================================= */

app.post("/api/match", async (req, res) => {
  try {
    const {
      requiredSkills,
      minExperience,
    } = req.body;

    if (
      !requiredSkills ||
      !Array.isArray(requiredSkills)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "requiredSkills must be an array",
      });
    }

    const candidates =
      await Candidate.find();

    const matchedCandidates =
      candidates
        .map((candidate) => {
          // Case Insensitive Match
          const matchedSkills =
            candidate.skills.filter(
              (skill) =>
                requiredSkills.some(
                  (reqSkill) =>
                    reqSkill.toLowerCase() ===
                    skill.toLowerCase()
                )
            );

          // Match Score
          const score =
            requiredSkills.length > 0
              ? matchedSkills.length /
                requiredSkills.length
              : 0;

          return {
            _id: candidate._id,
            name: candidate.name,
            email: candidate.email,
            skills: candidate.skills,
            experience:
              candidate.experience,
            projects:
              candidate.projects,

            matchedSkills,

            matchPercentage:
              Math.round(score * 100),

            ranking:
              score >= 0.8
                ? "High Match"
                : score >= 0.5
                ? "Medium Match"
                : "Low Match",
          };
        })

        // Experience Filter
        .filter(
          (candidate) =>
            candidate.experience >=
            (minExperience || 0)
        )

        // Sort by Match %
        .sort(
          (a, b) =>
            b.matchPercentage -
            a.matchPercentage
        );

    res.status(200).json({
      success: true,
      matchedCandidates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* =========================================
   AI SHORTLISTING API
========================================= */

app.post(
  "/api/ai/shortlist",
  async (req, res) => {
    try {
      const {
        requiredSkills,
        minExperience,
      } = req.body;

      const candidates =
        await Candidate.find();

      if (candidates.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "No candidates found",
        });
      }

      // OpenRouter API Key
      const OPENROUTER_API_KEY =
        process.env.OPENROUTER_API_KEY;

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({
          success: false,
          message:
            "OpenRouter API Key Missing",
        });
      }

      // Candidate Formatting
      const formattedCandidates =
        candidates
          .map(
            (candidate, index) =>
              `
${index + 1}. ${candidate.name}

Skills: ${candidate.skills.join(
                ", "
              )}

Experience: ${
                candidate.experience
              } years

Projects: ${
                candidate.projects
              }
`
          )
          .join("\n");

      // Prompt
      const prompt = `
You are an AI Hiring Assistant.

Job Requirements:
Skills: ${requiredSkills.join(
        ", "
      )}

Minimum Experience:
${minExperience} years

Candidates:
${formattedCandidates}

Tasks:
1. Rank candidates from best to worst
2. Explain why they are suitable
3. Give match percentage
4. Recommend best hire

Return response in JSON array format only.
`;

      // OpenRouter API Call
      const response =
        await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model:
              "google/gemini-2.5-flash:free",

            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,

              "Content-Type":
                "application/json",
            },
          }
        );

      let aiResponse =
        response.data.choices[0]
          .message.content;

      // Remove Markdown JSON Blocks
      aiResponse = aiResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      res.status(200).json({
        success: true,
        aiResult:
          JSON.parse(aiResponse),
      });
    } catch (error) {
      console.log(
        error.response?.data ||
          error.message
      );

      res.status(500).json({
        success: false,
        message:
          "❌ AI Shortlisting Failed",
      });
    }
  }
);

/* =========================================
   DELETE CANDIDATE
========================================= */

app.delete(
  "/api/candidates/:id",
  async (req, res) => {
    try {
      const candidate =
        await Candidate.findById(
          req.params.id
        );

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message:
            "Candidate not found",
        });
      }

      await candidate.deleteOne();

      res.status(200).json({
        success: true,
        message:
          "🗑️ Candidate Deleted",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/* =========================================
   404 ROUTE
========================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
  });
});

/* =========================================
   SERVER
========================================= */

app.listen(PORT, () => {
  console.log(
    `🚀 Server Running on Port ${PORT}`
  );
});