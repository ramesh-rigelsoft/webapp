import React from "react";

const GstPage = () => {

  const handleOpenGST = () => {
    window.electronAPI?.openGSTPortal("27ABCDE1234F1Z5");
  };

  return (
    <div>
      <h2>GST Page</h2>

      <button onClick={handleOpenGST}>
        Open GST Portal & Fill GST
      </button>
    </div>
  );
};

export default GstPage;