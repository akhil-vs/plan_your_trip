function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export interface PdfCollaborator {
  name: string;
  email: string;
  role: string;
}

export interface PdfWaypoint {
  id: string;
  name: string;
  notes?: string | null;
  visitMinutes: number;
  openMinutes: number;
  closeMinutes: number;
}

export interface PdfDayPlan {
  day: number;
  estimatedTravelMinutes: number;
  waypointIds: string[];
}

export interface TripPdfInput {
  tripName: string;
  status: string;
  isPublic: boolean;
  ownerName: string;
  ownerEmail: string;
  createdAtIso: string;
  updatedAtIso: string;
  collaborators: PdfCollaborator[];
  waypoints: PdfWaypoint[];
  dayPlans: PdfDayPlan[];
}

export function buildSimplePdf(title: string, lines: string[]) {
  const safeTitle = escapePdfText(title);
  const allLines = lines.map((line) => escapePdfText(line));
  const linesPerPage = 42;
  const pages: string[][] = [];
  for (let i = 0; i < allLines.length; i += linesPerPage) {
    pages.push(allLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([]);

  let objectIndex = 1;
  const objects: string[] = [];
  const pageObjects: number[] = [];

  const catalogId = objectIndex++;
  const pagesId = objectIndex++;
  const fontId = objectIndex++;

  pages.forEach((pageLines) => {
    const pageId = objectIndex++;
    const contentId = objectIndex++;
    const commands = [
      "BT",
      "/F1 18 Tf",
      "50 790 Td",
      `(${safeTitle}) Tj`,
      "/F1 10 Tf",
      "0 -24 Td",
      ...pageLines.map((line) => `(${line}) Tj T*`),
      "ET",
    ].join("\n");
    objects[pageId] =
      `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`;
    objects[contentId] =
      `${contentId} 0 obj\n<< /Length ${commands.length} >>\nstream\n${commands}\nendstream\nendobj\n`;
    pageObjects.push(pageId);
  });

  objects[catalogId] = `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`;
  objects[pagesId] = `${pagesId} 0 obj\n<< /Type /Pages /Kids [${pageObjects
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjects.length} >>\nendobj\n`;
  objects[fontId] = `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  const header = "%PDF-1.4\n";
  let body = "";
  const xref: number[] = [];
  xref[0] = 0;
  for (let i = 1; i < objectIndex; i += 1) {
    xref[i] = header.length + body.length;
    body += objects[i];
  }

  const xrefOffset = header.length + body.length;
  let xrefText = `xref\n0 ${objectIndex}\n0000000000 65535 f \n`;
  for (let i = 1; i < objectIndex; i += 1) {
    xrefText += `${xref[i].toString().padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objectIndex} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(`${header}${body}${xrefText}${trailer}`, "binary");
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (next.length > maxChars) {
      lines.push(current);
      current = words[i];
    } else {
      current = next;
    }
  }
  lines.push(current);
  return lines;
}

function formatClock(minutes: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hrs = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const mins = (clamped % 60).toString().padStart(2, "0");
  return `${hrs}:${mins}`;
}

function formatDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildTripItineraryPdf(input: TripPdfInput) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const footerY = 24;
  const pages: string[][] = [];
  let pageNumber = 0;

  const createPage = () => {
    pageNumber += 1;
    const commands: string[] = [];
    // Header band
    commands.push("0.09 0.33 0.72 rg");
    commands.push(`0 ${pageHeight - 58} ${pageWidth} 58 re f`);
    commands.push("1 1 1 rg");
    commands.push("BT");
    commands.push("/F2 16 Tf");
    commands.push(`${margin} ${pageHeight - 36} Td`);
    commands.push(`(${escapePdfText(input.tripName)}) Tj`);
    commands.push("ET");
    commands.push("BT");
    commands.push("/F1 9 Tf");
    commands.push(`${pageWidth - 190} ${pageHeight - 35} Td`);
    commands.push("(PlanYourTrip Premium Itinerary) Tj");
    commands.push("ET");

    // Footer
    commands.push("0.55 0.58 0.62 rg");
    commands.push(`${margin} ${footerY + 10} ${contentWidth} 0.6 re f`);
    commands.push("0.36 0.39 0.44 rg");
    commands.push("BT");
    commands.push("/F1 8 Tf");
    commands.push(`${margin} ${footerY} Td`);
    commands.push(`(Generated ${escapePdfText(formatDate(new Date().toISOString()))}) Tj`);
    commands.push("ET");
    commands.push("BT");
    commands.push("/F1 8 Tf");
    commands.push(`${pageWidth - margin - 44} ${footerY} Td`);
    commands.push(`(Page ${pageNumber}) Tj`);
    commands.push("ET");
    pages.push(commands);
    return { commands, y: pageHeight - 92 };
  };

  let state = createPage();

  const ensureSpace = (height: number) => {
    if (state.y - height < footerY + 28) {
      state = createPage();
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(28);
    state.commands.push("0.11 0.15 0.22 rg");
    state.commands.push("BT");
    state.commands.push("/F2 13 Tf");
    state.commands.push(`${margin} ${state.y} Td`);
    state.commands.push(`(${escapePdfText(title)}) Tj`);
    state.commands.push("ET");
    state.y -= 18;
  };

  const addCard = (lines: string[], options?: { light?: boolean; lineHeight?: number }) => {
    const lineHeight = options?.lineHeight ?? 13;
    const boxHeight = 12 + lines.length * lineHeight;
    ensureSpace(boxHeight + 10);
    if (options?.light) {
      state.commands.push("0.96 0.98 1 rg");
    } else {
      state.commands.push("0.985 0.99 1 rg");
    }
    state.commands.push(`${margin} ${state.y - boxHeight + 3} ${contentWidth} ${boxHeight} re f`);
    state.commands.push("0.78 0.84 0.93 RG");
    state.commands.push(`${margin} ${state.y - boxHeight + 3} ${contentWidth} ${boxHeight} re S`);
    let cursorY = state.y - 12;
    for (const line of lines) {
      state.commands.push("0.2 0.24 0.31 rg");
      state.commands.push("BT");
      state.commands.push("/F1 10 Tf");
      state.commands.push(`${margin + 10} ${cursorY} Td`);
      state.commands.push(`(${escapePdfText(line)}) Tj`);
      state.commands.push("ET");
      cursorY -= lineHeight;
    }
    state.y -= boxHeight + 10;
  };

  const stopCount = input.waypoints.length;
  const dayCount = input.dayPlans.length;

  addSectionTitle("Trip Snapshot");
  addCard([
    `Status: ${input.status}${input.isPublic ? " (Published)" : ""}`,
    `Owner: ${input.ownerName} <${input.ownerEmail}>`,
    `Collaborators: ${input.collaborators.length}`,
    `Stops: ${stopCount} | Planned days: ${dayCount}`,
    `Last updated: ${formatDate(input.updatedAtIso)}`,
  ]);

  addSectionTitle("Plan Health");
  const readiness =
    stopCount >= 3 && dayCount > 0
      ? "Ready to travel: route and day plans are set."
      : "Planning in progress: add more stops or regenerate day plan.";
  addCard([readiness, `Created: ${formatDate(input.createdAtIso)}`, "Travel notes stay attached to each stop."]);

  addSectionTitle("Collaborators");
  if (input.collaborators.length === 0) {
    addCard(["No collaborators yet. Invite editors/viewers to plan together."], {
      light: true,
    });
  } else {
    for (const person of input.collaborators) {
      addCard([`${person.name} (${person.role})`, `${person.email}`], { light: true });
    }
  }

  const waypointById = new Map(input.waypoints.map((wp) => [wp.id, wp]));
  addSectionTitle("Day-by-Day Itinerary");
  if (input.dayPlans.length === 0) {
    addCard(["No day plans generated yet. Run day-wise planning in the app and export again."]);
  } else {
    for (const day of input.dayPlans) {
      const stops = day.waypointIds.map((id) => waypointById.get(id)).filter(Boolean) as PdfWaypoint[];
      const lines: string[] = [];
      lines.push(
        `Day ${day.day}  |  Travel ${day.estimatedTravelMinutes} min  |  Stops ${stops.length}`
      );
      if (stops.length === 0) {
        lines.push("No assigned stops.");
      } else {
        stops.forEach((wp, index) => {
          const base = `${index + 1}. ${wp.name} (${wp.visitMinutes}m, ${formatClock(
            wp.openMinutes
          )}-${formatClock(wp.closeMinutes)})`;
          const wrappedBase = wrapText(base, 88);
          lines.push(...wrappedBase);
          if (wp.notes && wp.notes.trim()) {
            wrapText(`Note: ${wp.notes.trim()}`, 86).forEach((line) => {
              lines.push(`   ${line}`);
            });
          }
        });
      }
      addCard(lines);
    }
  }

  // Build raw PDF objects
  let objectIndex = 1;
  const objects: string[] = [];
  const pageObjects: number[] = [];
  const catalogId = objectIndex++;
  const pagesId = objectIndex++;
  const fontRegularId = objectIndex++;
  const fontBoldId = objectIndex++;

  for (const commands of pages) {
    const pageId = objectIndex++;
    const contentId = objectIndex++;
    const stream = commands.join("\n");
    objects[pageId] =
      `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>\nendobj\n`;
    objects[contentId] =
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
    pageObjects.push(pageId);
  }

  objects[catalogId] = `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`;
  objects[pagesId] = `${pagesId} 0 obj\n<< /Type /Pages /Kids [${pageObjects
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjects.length} >>\nendobj\n`;
  objects[fontRegularId] =
    `${fontRegularId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[fontBoldId] =
    `${fontBoldId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  const header = "%PDF-1.4\n";
  let body = "";
  const xref: number[] = [];
  xref[0] = 0;
  for (let i = 1; i < objectIndex; i += 1) {
    xref[i] = header.length + body.length;
    body += objects[i];
  }
  const xrefOffset = header.length + body.length;
  let xrefText = `xref\n0 ${objectIndex}\n0000000000 65535 f \n`;
  for (let i = 1; i < objectIndex; i += 1) {
    xrefText += `${xref[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objectIndex} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(`${header}${body}${xrefText}${trailer}`, "binary");
}
