// Test signin endpoint
const testSignin = async () => {
    try {
        const response = await fetch("http://localhost:5000/api/auth/signin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "test@example.com",
                password: "password123",
            }),
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Data:", data);
    } catch (error) {
        console.error("Error:", error);
    }
};

testSignin();
