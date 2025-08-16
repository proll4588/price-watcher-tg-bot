import axios from "axios";

async function healthCheck(): Promise<void> {
  try {
    const response = await axios.get("http://localhost:3000/health", {
      timeout: 5000,
    });

    if (response.status === 200 && response.data.status === "ok") {
      console.log("Health check passed");
      process.exit(0);
    } else {
      console.error("Health check failed: Invalid response");
      process.exit(1);
    }
  } catch (error) {
    console.error("Health check failed:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

// Запускаем проверку здоровья
healthCheck();
