import { useEffect } from "react";
import { supabase } from "../lib/supabase";

function Test() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("inventory")
        .select("*");

      console.log("Data:", data);
      console.log("Error:", error);
    }

    testConnection();
  }, []);

  return (
    <div style={{ padding: "30px" }}>
      <h1>🚀 Supabase Connection Test</h1>

      <p>
        Open the browser console to verify the connection.
      </p>

      <h3>If everything is correct you'll see:</h3>

      <pre>
Data: []
Error: null
      </pre>
    </div>
  );
}

export default Test;