# FloodSense Pitch

## 4-Minute Pitch Script

Good afternoon judges. We built **FloodSense**, a real-time flood intelligence product for Ho Chi Minh City.

Our starting point is simple: every rainy season, people in HCMC still make route decisions with incomplete information. Google Maps can tell you the fastest path, but it cannot tell you whether that road is already flooded, whether the risk is rising in the next few hours, or whether there is a safer alternative. FloodSense closes that gap.

What is important in this pitch is that I will start with what already exists in the product today.

Today, FloodSense already delivers a **live flood operations experience**.

First, we have a **real-time flood map** built with React, TypeScript, Zustand, and Mapbox. The map shows active flood segments, highlights critical zones, and supports route overlays, safe-route comparison, and flood focus states. The UI is not just a static visualization.

Second, we have a working **route intelligence workflow**. A user can enter origin and destination, preview the route on the map, or run a full flood-risk check. The system analyzes whether the route intersects active flood zones, generates warnings, estimates route risk, and, when possible, suggests a safer alternative route. We recently improved that logic so it can now consider both confirmed flood exposure and forecast-driven risk, not only currently confirmed flooding.

Third, FloodSense already includes **forecast-aware decision support**. The route-check API does not just return overlap warnings. It also produces a structured route forecast with risk level, confidence, summary, peak window, and reasons. That forecast is now strengthened by **route check history**: every successful route check is stored, shown back to the user in the interface, and used as additional context for future forecast generation. This means FloodSense is beginning to move from one-time alerts toward pattern-aware prediction.

Fourth, we already support **voice alerts**. Users can choose between two Vietnamese voice options, and the app speaks after both route preview and route check. The voice response explicitly tells the user whether forecast alerts exist or not, instead of only speaking when something goes wrong. This matters for motorbike users because hands-free feedback is much safer than requiring constant screen attention.

Fifth, we built **simulation and demo reliability** directly into the product. FloodSense has a simulate-heavy-rain flow, and we hardened it so repeated simulation no longer crashes the page. That matters because reliability is part of product quality, not just demo polish.

Sixth, we already have **saved routes, route history, analytics surfaces, and reporting interfaces** inside the codebase. The product is not a single-page prototype. It already behaves like an operational dashboard: map, route results, warnings, route history, hotspot analytics, flood history, saved routes, and voice-enabled notifications.

FloodSense expands into a broader **city flood intelligence platform**. That includes an Exa.ai plus OpenAI ingestion pipeline for Vietnamese news and social signals, n8n orchestration every few minutes, proactive saved-route notifications, official weather pre-warning, traffic camera monitoring. These are not just random add-ons. They fit one architecture: combine weak signals from multiple sources into one confidence-driven flood intelligence engine.

That extension is where the long-term impact becomes very strong. FloodSense can become the layer that tells commuters, families, delivery fleets, and mobility operators not just where traffic is slow, but where movement is becoming unsafe.

So the core message is this: **FloodSense is already a working flood-aware route intelligence product today, and it has a credible path to become a multi-signal urban resilience platform tomorrow.**

We are not pitching an idea only. We are pitching a functioning system, with a clear roadmap to scale its intelligence, reliability, and city-level relevance.

Thank you.
