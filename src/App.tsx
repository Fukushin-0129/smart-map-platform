import { useState } from "react"

function App() {
  const [message, setMessage] = useState("")

  const showCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("このブラウザでは現在地を取得できません")
      return
    }

    setMessage("現在地を取得中...")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setMessage(`現在地: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      },
      () => {
        setMessage("現在地の取得が許可されませんでした")
      }
    )
  }

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

      <button
        onClick={showCurrentLocation}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 20,
          padding: "12px 16px",
          borderRadius: "8px",
          border: "none",
          background: "white",
          fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          cursor: "pointer",
        }}
      >
        現在地を表示
      </button>

      {message && (
        <div
          style={{
            position: "absolute",
            top: "72px",
            right: "20px",
            zIndex: 20,
            background: "white",
            padding: "10px 14px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            fontWeight: "bold",
          }}
        >
          {message}
        </div>
      )}

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