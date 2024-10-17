import React, { useState } from "react";

const TestPage = () => {
  const [testState, setTestState] = useState("hi");
  return (
    <div>
      <p>{testState}</p>
    </div>
  );
};

export default TestPage;
