"use client";

import React, { useEffect, useState } from "react";

export default function BulletproofSensor() {
  const [status, setStatus] = useState("V5 LOADING...");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(0);
  const [wsStatus, setWsStatus] = useState("Searching for laptop...");

  useEffect(() => {
    setStatus("READY. TAP START.");
  }, []);

  function start() {
    setStatus("SENSORS ACTIVE ✅");
    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      window.addEventListener("devicemotion", (e) => {
        const acc = e.accelerationIncludingGravity;
        if (acc) {
          const curX = acc.x || 0;
          const curY = acc.y || 0;
          const curZ = acc.z || 0;
          setX(curX);
          setY(curY);
          setZ(curZ);
        }
      }, true);
    } else {
      setStatus("ERROR: NO SENSOR API");
    }
  }

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#0070f3' }}>BHS SENSOR v5</h1>
      
      <div style={{ padding: '20px', border: '1px solid #0f0', color: '#0f0', marginBottom: '20px' }}>
        <strong>STATUS:</strong> {status}
      </div>

      <button onClick={start} style={{ 
        width: '100%', 
        height: '100px', 
        fontSize: '25px', 
        fontWeight: 'bold', 
        background: '#0070f3', 
        color: '#fff', 
        border: 'none',
        borderRadius: '10px'
      }}>
        START SENSING
      </button>

      <div style={{ fontSize: '30px', marginTop: '40px' }}>
        <p>X: {x.toFixed(2)}</p>
        <p>Y: {y.toFixed(2)}</p>
        <p>Z: {z.toFixed(2)}</p>
      </div>
      
      <p style={{ marginTop: '20px', fontSize: '10px', color: '#444' }}>
        Verify Chrome Flag for http://{typeof window !== 'undefined' ? window.location.hostname : 'IP'}:3000
      </p>
    </div>
  );
}
