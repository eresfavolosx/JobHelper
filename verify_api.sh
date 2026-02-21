#!/bin/bash
echo "Testing Find Jobs API..."
curl -X POST http://localhost:3000/api/find-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["react", "frontend", "remote"],
    "resumeData": {
        "targetRole": "Frontend Engineer",
        "experienceLevel": "Mid-Senior",
        "skills": ["React", "JavaScript", "Next.js"]
    }
}'
echo -e "\n\nDone."
