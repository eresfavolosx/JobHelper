const fs = require('fs');
const path = require('path');

async function checkModels() {
    // Read .env.local
    const envPath = path.join(process.cwd(), '.env.local');
    let apiKey;
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (match) apiKey = match[1].trim();
    } catch (err) {
        console.error("Could not read .env.local");
        return;
    }

    if (!apiKey) {
        console.error("No API Key found.");
        return;
    }

    console.log(`Checking models for API Key: ${apiKey.substring(0, 5)}...`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", data.error);
            return;
        }

        console.log("\nAvailable FLASH Models:");
        if (data.models) {
            const flashModels = data.models.filter(m => m.name.toLowerCase().includes('flash'));
            if (flashModels.length === 0) {
                console.log("No 'flash' models found. Listing ALL models:");
                data.models.forEach(m => console.log(`- ${m.name}`));
            } else {
                flashModels.forEach(m => console.log(`- ${m.name}`));
            }
        } else {
            console.log("No models returned.");
        }
    } catch (error) {
        console.error("Network Error:", error);
    }
}

checkModels();
