function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <iframe
        title="Suita Map"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        src="https://www.google.com/maps?q=吹田市&z=13&output=embed"
      />

      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: "translate(-50%, -100%)",
          fontSize: "48px",
          zIndex: 10,
        }}
      >
        📍
      </div>

      <div
        style={{
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: "translate(-50%, 10px)",
          background: "white",
          padding: "8px 12px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          zIndex: 10,
          fontWeight: "bold",
        }}
      >
        吹田市役所
      </div>
    </div>
  )
}

export default App