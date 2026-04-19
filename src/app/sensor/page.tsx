"use client";

import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

export default function BulletproofSensor() {
  const [status, setStatus] = useState("V5 LOADING...");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(0);
  const [wsStatus, setWsStatus] = useState("Searching for laptop...");
  const [eventCount, setEventCount] = useState(0);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    setStatus("READY. TAP START.");
    
    // Connect to WebSocket
    const socket = io({
      transports: ["websocket"] // This bypasses Serveo's HTTP warning page!
    });
    socketRef.current = socket;
    
    socket.on("connect", () => {
      setWsStatus("CONNECTED TO LAPTOP ✅");
    });
    
    socket.on("disconnect", () => {
      setWsStatus("DISCONNECTED ❌");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function start() {
    setStatus("REQUESTING PERMISSION...");
    
    // Request permission for iOS 13+ devices
    if (typeof (DeviceMotionEvent as any) !== 'undefined' && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission !== 'granted') {
          setStatus("ERROR: PERMISSION DENIED");
          return;
        }
      } catch (err) {
        setStatus("ERROR: " + String(err));
        return;
      }
    }

    setStatus("SENSORS ACTIVE ✅");
    
    let localCount = 0;
    
    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      window.addEventListener("devicemotion", (e) => {
        localCount++;
        // Only update React state every 20 frames so we don't freeze the phone
        if (localCount % 20 === 0) {
           setEventCount(localCount);
        }
        
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (acc) {
          const curX = acc.x || 0;
          const curY = acc.y || 0;
          const curZ = acc.z || 0;
          setX(curX);
          setY(curY);
          setZ(curZ);
          
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("vibration_data", { x: curX, y: curY, z: curZ });
          }
        }
      }, true);
    } else {
      setStatus("ERROR: NO SENSOR API (Device Unsupported)");
    }
  }

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#0070f3' }}>BHS SENSOR v5</h1>
      
      <div style={{ padding: '20px', border: '1px solid #0f0', color: '#0f0', marginBottom: '20px' }}>
        <strong>SENSOR:</strong> {status} <br/>
        <strong>NETWORK:</strong> {wsStatus} <br/>
        <strong>EVENTS FIRED:</strong> {eventCount}
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
        Data streaming live to laptop dashboard via WebSockets.
      </p>
    </div>
  );
}
