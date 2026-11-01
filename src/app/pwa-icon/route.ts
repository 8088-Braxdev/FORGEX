
import { ImageResponse } from "next/og";
import { createElement } from "react";

export async function GET(request: Request) {
  const requestedSize = new URL(request.url)
    .searchParams.get("size");

  if (
    requestedSize !== "192" &&
    requestedSize !== "512"
  ) {
    return new Response("Unsupported icon size.", {
      status: 404,
    });
  }

  const size = Number(requestedSize);
  const inset = Math.round(size * 0.13);

  const icon = createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#101920",
      },
    },
    createElement(
      "div",
      {
        style: {
          width: size - inset * 2,
          height: size - inset * 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d3027",
          border: `${Math.round(size * 0.035)}px solid #b9fa77`,
          borderRadius: Math.round(size * 0.18),
        },
      },
      createElement(
        "span",
        {
          style: {
            color: "#b9fa77",
            fontSize: Math.round(size * 0.28),
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: -Math.round(size * 0.015),
          },
        },
        "<>"
      )
    )
  );

  return new ImageResponse(icon, {
    width: size,
    height: size,
  });
}
