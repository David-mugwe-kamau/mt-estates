"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  {
    src: "/images/pic1.jpg",
    alt: "Modern apartment exterior",
  },
  {
    src: "/images/pic2.jpg",
    alt: "Cozy living room interior",
  },
  {
    src: "/images/pic3.jpg",
    alt: "Airbnb-style short-stay apartment",
  },
];

export function HeroSlider() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-slate-200 shadow-lg md:h-80">
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Blurred backdrop to fill side space while preserving full image. */}
          <img
            src={slide.src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover blur-md scale-110 opacity-50"
            loading="lazy"
          />
          {/* Using a plain img avoids Next Image optimizer 400s if file missing. */}
          <img
            src={slide.src}
            alt={slide.alt}
            className="relative z-10 h-full w-full object-contain"
            loading={i === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {SLIDES.map((slide, i) => (
          <span
            key={slide.src}
            className={`h-2 w-2 rounded-full border border-white/70 bg-white/60 transition ${
              i === index ? "scale-110 bg-mt-orange" : "opacity-60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

