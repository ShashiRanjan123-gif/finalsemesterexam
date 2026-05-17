import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  // 🚀 UPDATED ACCORDING TO YOUR NEW BACKEND RENDER LINK
  const API = "https://finalsemesterexam.onrender.com";

  // State Management
  const [candidates, setCandidates] = useState([]);
  const [candidateData, setCandidateData] = useState({
    name: "",
    email: "",
    skills: "",
    experience: "",
    projects: "",
  });

  const [jobData, setJobData] = useState({
    requiredSkills: "",
    minExperience: "",
  });

  const [matchedCandidates, setMatchedCandidates] = useState([]);
  const [aiResult, setAiResult] = useState([]);

  // 1. GET ALL CANDIDATES
  const fetchCandidates = async () => {
    try {
      const res = await axios.get(`${API}/api/candidates`);
      setCandidates(res.data);
    } catch (error) {
      console.error("Error fetching candidates:", error);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // 2. ADD NEW CANDIDATE
  const addCandidate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/candidates`, {
        ...candidateData,
        experience: Number(candidateData.experience),
        // String ko clean array me split aur trim karne ka logic
        skills: candidateData.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter((skill) => skill !== ""),
      });

      alert("✅ Candidate Added Successfully");

      // Form Reset
      setCandidateData({
        name: "",
        email: "",
        skills: "",
        experience: "",
        projects: "",
      });

      fetchCandidates(); // Fresh list load karne ke liye
    } catch (error) {
      console.error("Error adding candidate:", error);
      alert("❌ Failed to add candidate (Check if email is duplicate)");
    }
  };

  // 3. BASIC MATCHING LOGIC
  const matchCandidates = async () => {
    try {
      const res = await axios.post(`${API}/api/match`, {
        requiredSkills: jobData.requiredSkills
          .split(",")
          .map((skill) => skill.trim())
          .filter((skill) => skill !== ""),
        minExperience: Number(jobData.minExperience),
      });

      setMatchedCandidates(res.data);
    } catch (error) {
      console.error("Error matching candidates:", error);
    }
  };

  // 4. AI-BASED SHORTLISTING (OpenRouter AI)
  const aiShortlisting = async () => {
    try {
      const res = await axios.post(`${API}/api/ai/shortlist`, {
        requiredSkills: jobData.requiredSkills
          .split(",")
          .map((skill) => skill.trim())
          .filter((skill) => skill !== ""),
        minExperience: Number(jobData.minExperience),
      });

      if (res.data && res.data.ranking) {
        setAiResult(res.data.ranking);
        alert("✅ AI Shortlisting Completed!");
      }
    } catch (error) {
      console.error("AI Shortlisting Error:", error);
      alert("❌ AI Shortlisting Failed");
    }
  };

  return (
    <div className="container">
      <h1>🚀 AI Candidate Shortlisting System</h1>

      {/* SECTION 1: Add Candidate Form */}
      <div className="card">
        <h2>Add Candidate Details</h2>
        <form onSubmit={addCandidate}>
          <input
            type="text"
            placeholder="Enter Full Name"
            required
            value={candidateData.name}
            onChange={(e) => setCandidateData({ ...candidateData, name: e.target.value })}
          />

          <input
            type="email"
            placeholder="Enter Email Address"
            required
            value={candidateData.email}
            onChange={(e) => setCandidateData({ ...candidateData, email: e.target.value })}
          />

          <input
            type="text"
            placeholder="Skills (Comma separated, e.g. React, Node.js, MongoDB)"
            required
            value={candidateData.skills}
            onChange={(e) => setCandidateData({ ...candidateData, skills: e.target.value })}
          />

          <input
            type="number"
            placeholder="Experience (In Years)"
            required
            value={candidateData.experience}
            onChange={(e) => setCandidateData({ ...candidateData, experience: e.target.value })}
          />

          <textarea
            placeholder="Projects Summary / Professional Bio"
            value={candidateData.projects}
            onChange={(e) => setCandidateData({ ...candidateData, projects: e.target.value })}
          ></textarea>

          <div className="button-group">
            <button type="submit">Save Profile</button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Job Requirements Form */}
      <div className="card">
        <h2>Job Criteria Input</h2>
        <input
          type="text"
          placeholder="Target Skills Required (e.g. React, Node.js)"
          value={jobData.requiredSkills}
          onChange={(e) => setJobData({ ...jobData, requiredSkills: e.target.value })}
        />

        <input
          type="number"
          placeholder="Minimum Experience Threshold"
          value={jobData.minExperience}
          onChange={(e) => setJobData({ ...jobData, minExperience: e.target.value })}
        />

        <div className="button-group">
          <button onClick={matchCandidates}>Basic Keyword Filter</button>
          <button onClick={aiShortlisting} style={{ backgroundColor: "#6200ea", color: "white" }}>
            🧠 AI Smart Match
          </button>
        </div>
      </div>

      {/* SECTION 3: All Candidate Database Profiles */}
      <div className="card">
        <h2>All Database Candidates</h2>
        {candidates.length === 0 ? (
          <p className="fallback-text">No Profiles Registered In The Database Yet.</p>
        ) : (
          candidates.map((candidate) => (
            <div className="candidate-card" key={candidate._id}>
              <h3>{candidate.name}</h3>
              <p><strong>Email:</strong> {candidate.email}</p>
              <p><strong>Skills Stack:</strong> {candidate.skills.join(", ")}</p>
              <p><strong>Experience:</strong> {candidate.experience} Years</p>
              {candidate.projects && <p><strong>Projects:</strong> {candidate.projects}</p>}
            </div>
          ))
        )}
      </div>

      {/* SECTION 4: Shortlisted Candidates Display (Basic Logic) */}
      <div className="card">
        <h2>Shortlisted Candidates (Algorithmic Filter)</h2>
        {matchedCandidates.length === 0 ? (
          <p className="fallback-text">No Basic Match Computed Yet.</p>
        ) : (
          matchedCandidates.map((candidate, index) => (
            <div className="candidate-card filter-highlight" key={candidate._id || index}>
              <h3>{candidate.name}</h3>
              <p><strong>Match Score:</strong> <span className="score-badge">{candidate.matchScore}%</span></p>
              <p><strong>Matched Skills:</strong> {candidate.matchedSkills?.join(", ") || "None"}</p>
              <p><strong>Experience Matrix:</strong> {candidate.experience} Years</p>
            </div>
          ))
        )}
      </div>

      {/* SECTION 5: AI Recommendation Smart Display */}
      <div className="card">
        <h2>🧠 OpenRouter AI Recommendations</h2>
        {aiResult.length === 0 ? (
          <p className="fallback-text">No AI Assessment Requested Yet. Click "AI Smart Match".</p>
        ) : (
          aiResult.map((item, index) => (
            <div className="candidate-card ai-highlight" key={index}>
              <h3>Rank #{index + 1}: {item.name}</h3>
              {item.matchScore && <p><strong>AI Fit Indicator:</strong> <span className="score-badge ai-badge">{item.matchScore}%</span></p>}
              <div className="ai-explanation-box">
                //
                <strong>AI Suitability Reasoning:</strong>
                <p>{item.aiExplanation}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;