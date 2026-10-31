"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  DoorOpen,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import {
  mockAdminApi,
  type Incident,
  type Reservation,
  type Room,
  type Seat,
} from "@/lib/admin-data";

type Section = "overview" | "rooms" | "reservations" | "seats" | "incidents";
const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "reservations", label: "Reservations", icon: CalendarDays },
  { id: "seats", label: "Seat management", icon: UsersRound },
  { id: "incidents", label: "Incidents", icon: Wrench },
] as const;
const titles: Record<Section, string> = {
  overview: "Overview",
  rooms: "Room management",
  reservations: "Reservations",
  seats: "Seat management",
  incidents: "Incident reports",
};
const descriptions: Record<Section, string> = {
  overview: "Here's what's happening across your campus today.",
  rooms: "Manage room availability and building information.",
  reservations: "Review and manage room booking requests.",
  seats: "Monitor seat availability across rooms.",
  incidents: "Track and resolve reported facility issues.",
};
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
const timeOnly = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
const statusClass = (value: string) =>
  `admin-badge badge-${value.toLowerCase()}`;
const categoryLabel: Record<Incident["category"], string> = {
  PROJECTOR: "Projector",
  AC: "Air conditioning",
  LIGHTING: "Lighting",
  SOUND: "Sound",
  OTHER: "Other",
};

export function AdminPortal() {
  const [section, setSection] = useState<Section>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selectedRoom, setSelectedRoom] = useState<number>(3);
  const [dialog, setDialog] = useState<"room" | "incident" | null>(null);
  const [message, setMessage] = useState("");
  const { data: initialRooms } = useSWR(
    "admin-demo-rooms",
    mockAdminApi.listRooms,
  );
  const { data: initialReservations } = useSWR(
    "admin-demo-reservations",
    mockAdminApi.listReservations,
  );
  const { data: initialSeats } = useSWR(
    "admin-demo-seats",
    mockAdminApi.listSeats,
  );
  const { data: initialIncidents } = useSWR(
    "admin-demo-incidents",
    mockAdminApi.listIncidents,
  );
  const [roomEdits, setRoomEdits] = useState<Room[]>([]);
  const [reservationEdits, setReservationEdits] = useState<Reservation[]>([]);
  const [seatEdits, setSeatEdits] = useState<Seat[]>([]);
  const [incidentEdits, setIncidentEdits] = useState<Incident[]>([]);
  const rooms = roomEdits.length ? roomEdits : (initialRooms ?? []);
  const reservations = reservationEdits.length
    ? reservationEdits
    : (initialReservations ?? []);
  const seats = seatEdits.length ? seatEdits : (initialSeats ?? []);
  const incidents = incidentEdits.length
    ? incidentEdits
    : (initialIncidents ?? []);
  const loading =
    !initialRooms || !initialReservations || !initialSeats || !initialIncidents;
  const chooseSection = (next: Section) => {
    setSection(next);
    setQuery("");
    setFilter("ALL");
    setMessage("");
    setMobileOpen(false);
  };
  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  };
  const changeReservation = (id: number, status: Reservation["status"]) => {
    setReservationEdits(
      reservations.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    notify(`Reservation #${id} marked ${status.toLowerCase()} in demo.`);
  };
  const changeIncident = (id: number, status: Incident["status"]) => {
    setIncidentEdits(
      incidents.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    notify(
      `Incident #${id} marked ${status.toLowerCase().replace("_", " ")} in demo.`,
    );
  };
  const changeSeat = (id: number, status: Seat["status"]) => {
    setSeatEdits(
      seats.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    notify(`Seat updated to ${status.toLowerCase()} in demo.`);
  };
  const addRoom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "")
      .trim()
      .toUpperCase();
    if (rooms.some((room) => room.code === code)) {
      notify("This room code already exists.");
      return;
    }
    const capacity = Number(form.get("capacity"));
    if (!Number.isInteger(capacity) || capacity < 1) return;
    const room: Room = {
      id: Math.max(0, ...rooms.map((item) => item.id)) + 1,
      code,
      name: String(form.get("name") ?? "").trim(),
      location: String(form.get("location") ?? "").trim(),
      status: String(form.get("status")) as Room["status"],
      capacity,
    };
    setRoomEdits([...rooms, room]);
    setDialog(null);
    notify(`Room ${code} added to demo.`);
  };
  const addIncident = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const room = rooms.find((item) => item.id === Number(form.get("roomId")));
    if (!room) return;
    const incident: Incident = {
      id: Math.max(0, ...incidents.map((item) => item.id)) + 1,
      roomId: room.id,
      roomCode: room.code,
      category: String(form.get("category")) as Incident["category"],
      description: String(form.get("description") ?? "").trim(),
      reporterName: String(form.get("reporterName") ?? "").trim(),
      priority: String(form.get("priority")) as Incident["priority"],
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };
    setIncidentEdits([incident, ...incidents]);
    setDialog(null);
    notify(`Incident #${incident.id} added to demo.`);
  };
  const matches = (text: string) =>
    text.toLowerCase().includes(query.toLowerCase().trim());
  const filteredRooms = rooms.filter(
    (room) =>
      (filter === "ALL" || room.status === filter) &&
      matches(`${room.code} ${room.name} ${room.location}`),
  );
  const filteredReservations = reservations.filter(
    (item) =>
      (filter === "ALL" || item.status === filter) &&
      matches(
        `${item.id} ${item.userId} ${item.roomCode ?? rooms.find((room) => room.id === item.roomId)?.code ?? ""}`,
      ),
  );
  const filteredIncidents = incidents.filter(
    (item) =>
      (filter === "ALL" || item.status === filter) &&
      matches(
        `${item.id} ${item.roomCode} ${item.reporterName} ${item.description}`,
      ),
  );
  const pending = reservations.filter(
    (item) => item.status === "PENDING",
  ).length;

  return (
    <div className="admin-root">
      {mobileOpen && (
        <button
          className="admin-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <a className="admin-brand" href="/" aria-label="TDTU Smart Campus home">
          <span className="admin-brand-mark">
            <Building2 size={22} />
          </span>
          <span>
            <strong>
              TDTU <em>Smart Campus</em>
            </strong>
            <small>ADMIN PORTAL</small>
          </span>
        </a>
        <div className="admin-workspace">
          <span className="workspace-avatar">T</span>
          <span>
            <strong>TDTU Campus</strong>
            <small>Administration workspace</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          <span className="nav-caption">WORKSPACE</span>
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? "active" : ""}
              onClick={() => chooseSection(item.id)}
            >
              <item.icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.id === "reservations" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </button>
          ))}
          <span className="nav-caption nav-caption-lower">GENERAL</span>
          <a href="mailto:helpdesk@tdtu.edu.vn">
            <LifeBuoy size={18} strokeWidth={1.8} /> Help & support{" "}
            <ArrowUpRight size={14} className="nav-external" />
          </a>
          <a href="/">
            <ArrowDownRight size={18} strokeWidth={1.8} /> Back to website
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="sidebar-help-icon">
              <LifeBuoy size={19} />
            </span>
            <strong>Need a hand?</strong>
            <p>Contact campus IT support for assistance.</p>
            <a href="mailto:helpdesk@tdtu.edu.vn">
              Get support <ArrowRight size={14} />
            </a>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">AD</span>
            <span>
              <strong>Admin User</strong>
              <small>Demo administrator</small>
            </span>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              className="admin-mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{titles[section]}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-indicator">
              <span /> DEMO MODE
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => notify("No new notifications in demo mode.")}
            >
              <Bell size={19} />
            </button>
            <span className="topbar-avatar">AD</span>
          </div>
        </header>
        <main className="admin-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                CAMPUS ADMINISTRATION <span>/</span>{" "}
                {titles[section].toUpperCase()}
              </div>
              <h1>
                {titles[section]}
                <span className="heading-dot">.</span>
              </h1>
              <p>{descriptions[section]}</p>
            </div>
            <div className="page-actions">
              {section === "rooms" && (
                <button
                  className="admin-primary"
                  onClick={() => setDialog("room")}
                >
                  <Plus size={17} /> Add room
                </button>
              )}
              {section === "incidents" && (
                <button
                  className="admin-primary"
                  onClick={() => setDialog("incident")}
                >
                  <Plus size={17} /> Report incident
                </button>
              )}
              {section === "overview" && (
                <span className="date-pill">
                  <CalendarDays size={16} /> Campus overview
                </span>
              )}
            </div>
          </div>
          <div className="demo-note">
            <CircleAlert size={17} />
            <span>
              Preview workspace: sample data and changes are temporary. This
              portal is not connected to your Spring Boot API or PostgreSQL
              database.
            </span>
          </div>
          {loading ? (
            <div className="admin-loading" role="status">
              Loading demo workspace...
            </div>
          ) : (
            <>
              {section === "overview" && (
                <Overview
                  rooms={rooms}
                  reservations={reservations}
                  incidents={incidents}
                  seats={seats}
                  onNavigate={chooseSection}
                />
              )}
              {section === "rooms" && (
                <>
                  <ListToolbar
                    query={query}
                    setQuery={setQuery}
                    filter={filter}
                    setFilter={setFilter}
                    options={["ALL", "ACTIVE", "MAINTENANCE"]}
                    placeholder="Search rooms by code, name or location..."
                    count={filteredRooms.length}
                  />
                  <div className="admin-panel table-panel">
                    <div className="table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>ROOM</th>
                            <th>LOCATION</th>
                            <th>CAPACITY</th>
                            <th>STATUS</th>
                            <th className="align-right">ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRooms.map((room) => (
                            <tr key={room.id}>
                              <td>
                                <div className="entity-cell">
                                  <span className="entity-icon">
                                    <DoorOpen size={18} />
                                  </span>
                                  <span>
                                    <strong>{room.name}</strong>
                                    <small>
                                      #{room.id} · {room.code}
                                    </small>
                                  </span>
                                </div>
                              </td>
                              <td>{room.location}</td>
                              <td>{room.capacity ?? "—"} seats</td>
                              <td>
                                <span className={statusClass(room.status)}>
                                  <i />
                                  {room.status === "ACTIVE"
                                    ? "Active"
                                    : "Maintenance"}
                                </span>
                              </td>
                              <td className="align-right">
                                <button
                                  className="text-action"
                                  onClick={() => {
                                    setSelectedRoom(room.id);
                                    chooseSection("seats");
                                  }}
                                >
                                  View seats <ArrowRight size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!filteredRooms.length && <EmptyTable />}
                    </div>
                    <TableFooter count={filteredRooms.length} />
                  </div>
                </>
              )}
              {section === "reservations" && (
                <>
                  <ListToolbar
                    query={query}
                    setQuery={setQuery}
                    filter={filter}
                    setFilter={setFilter}
                    options={[
                      "ALL",
                      "PENDING",
                      "CONFIRMED",
                      "CANCELLED",
                      "REJECTED",
                    ]}
                    placeholder="Search by ID, user ID or room code..."
                    count={filteredReservations.length}
                  />
                  <div className="admin-panel table-panel">
                    <div className="table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>BOOKING</th>
                            <th>ROOM / USER</th>
                            <th>TIME SLOT</th>
                            <th>STATUS</th>
                            <th className="align-right">ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredReservations.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <div className="entity-cell">
                                  <span className="entity-icon">
                                    <CalendarDays size={18} />
                                  </span>
                                  <span>
                                    <strong>Reservation #{item.id}</strong>
                                    <small>
                                      Created {dateTime(item.createdAt)}
                                    </small>
                                  </span>
                                </div>
                              </td>
                              <td>
                                <strong className="cell-strong">
                                  {item.roomCode ??
                                    rooms.find(
                                      (room) => room.id === item.roomId,
                                    )?.code ??
                                    `Room #${item.roomId}`}
                                </strong>
                                <small className="cell-sub">
                                  User #{item.userId} · Room ID {item.roomId}
                                </small>
                              </td>
                              <td>
                                <strong className="cell-strong">
                                  {dateTime(item.startTime)}
                                </strong>
                                <small className="cell-sub">
                                  {timeOnly(item.startTime)} –{" "}
                                  {timeOnly(item.endTime)}
                                </small>
                              </td>
                              <td>
                                <span className={statusClass(item.status)}>
                                  <i />
                                  {item.status}
                                </span>
                              </td>
                              <td className="align-right">
                                {item.status === "PENDING" ? (
                                  <span className="action-pair">
                                    <button
                                      className="mini-action accept"
                                      onClick={() =>
                                        changeReservation(item.id, "CONFIRMED")
                                      }
                                      title="Confirm reservation"
                                      aria-label={`Confirm reservation ${item.id}`}
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      className="mini-action decline"
                                      onClick={() =>
                                        changeReservation(item.id, "REJECTED")
                                      }
                                      title="Reject reservation"
                                      aria-label={`Reject reservation ${item.id}`}
                                    >
                                      <X size={16} />
                                    </button>
                                  </span>
                                ) : item.status === "CONFIRMED" ? (
                                  <button
                                    className="text-action"
                                    onClick={() =>
                                      changeReservation(item.id, "CANCELLED")
                                    }
                                  >
                                    Cancel
                                  </button>
                                ) : (
                                  <span className="muted-dash">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!filteredReservations.length && <EmptyTable />}
                    </div>
                    <TableFooter count={filteredReservations.length} />
                  </div>
                </>
              )}
              {section === "seats" && (
                <SeatSection
                  rooms={rooms}
                  seats={seats}
                  selectedRoom={selectedRoom}
                  setSelectedRoom={setSelectedRoom}
                  onChange={changeSeat}
                />
              )}
              {section === "incidents" && (
                <>
                  <ListToolbar
                    query={query}
                    setQuery={setQuery}
                    filter={filter}
                    setFilter={setFilter}
                    options={["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"]}
                    placeholder="Search incidents by room, reporter or description..."
                    count={filteredIncidents.length}
                  />
                  <div className="admin-panel table-panel">
                    <div className="table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>INCIDENT</th>
                            <th>ROOM / REPORTER</th>
                            <th>PRIORITY</th>
                            <th>STATUS</th>
                            <th className="align-right">ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredIncidents.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <div className="entity-cell">
                                  <span className="entity-icon warning-icon">
                                    <Wrench size={18} />
                                  </span>
                                  <span>
                                    <strong>
                                      {categoryLabel[item.category]} · #
                                      {item.id}
                                    </strong>
                                    <small
                                      className="description-small"
                                      title={item.description}
                                    >
                                      {item.description}
                                    </small>
                                  </span>
                                </div>
                              </td>
                              <td>
                                <strong className="cell-strong">
                                  {item.roomCode}
                                </strong>
                                <small className="cell-sub">
                                  {item.reporterName} ·{" "}
                                  {dateTime(item.createdAt)}
                                </small>
                              </td>
                              <td>
                                <span className={statusClass(item.priority)}>
                                  {item.priority}
                                </span>
                              </td>
                              <td>
                                <span className={statusClass(item.status)}>
                                  <i />
                                  {item.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="align-right">
                                {item.status !== "RESOLVED" ? (
                                  <button
                                    className="text-action"
                                    onClick={() =>
                                      changeIncident(
                                        item.id,
                                        item.status === "OPEN"
                                          ? "IN_PROGRESS"
                                          : "RESOLVED",
                                      )
                                    }
                                  >
                                    {item.status === "OPEN"
                                      ? "Start work"
                                      : "Resolve"}{" "}
                                    <ArrowRight size={15} />
                                  </button>
                                ) : (
                                  <span className="muted-dash">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!filteredIncidents.length && <EmptyTable />}
                    </div>
                    <TableFooter count={filteredIncidents.length} />
                  </div>
                </>
              )}
            </>
          )}
          <div className="admin-page-footer">
            <span>© 2026 TDTU Smart Campus · Admin Portal Demo</span>
            <span>
              All systems illustrative <span className="footer-live-dot" />
            </span>
          </div>
        </main>
      </div>
      {message && (
        <div className="admin-toast" role="status">
          <Check size={16} />
          {message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {dialog && (
        <div
          className="admin-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-heading"
          >
            <div className="dialog-heading">
              <div>
                <span className="page-eyebrow">DEMO WORKSPACE</span>
                <h2 id="dialog-heading">
                  {dialog === "room" ? "Add a new room" : "Report an incident"}
                </h2>
                <p>Changes are temporary and will reset when you reload.</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setDialog(null)}
              >
                <X size={19} />
              </button>
            </div>
            {dialog === "room" ? (
              <form onSubmit={addRoom} className="dialog-form">
                <label>
                  Room code
                  <input
                    name="code"
                    placeholder="e.g. A101"
                    maxLength={20}
                    required
                  />
                </label>
                <label>
                  Room name
                  <input
                    name="name"
                    placeholder="e.g. Lecture Room A101"
                    maxLength={100}
                    required
                  />
                </label>
                <label>
                  Location
                  <input
                    name="location"
                    placeholder="e.g. Building A - Floor 1"
                    maxLength={120}
                    required
                  />
                </label>
                <div className="form-row">
                  <label>
                    Capacity
                    <input
                      name="capacity"
                      type="number"
                      min="1"
                      max="10000"
                      placeholder="40"
                      required
                    />
                  </label>
                  <label>
                    Status
                    <select name="status">
                      <option value="ACTIVE">Active</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </select>
                  </label>
                </div>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() => setDialog(null)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="admin-primary">
                    Add room <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={addIncident} className="dialog-form">
                <div className="form-row">
                  <label>
                    Room
                    <select name="roomId" required>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.code} · {room.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Category
                    <select name="category">
                      {Object.entries(categoryLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    name="description"
                    placeholder="Describe the issue..."
                    minLength={5}
                    maxLength={500}
                    required
                  />
                </label>
                <div className="form-row">
                  <label>
                    Reporter name
                    <input name="reporterName" maxLength={100} required />
                  </label>
                  <label>
                    Priority
                    <select name="priority">
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </label>
                </div>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() => setDialog(null)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="admin-primary">
                    Submit report <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Overview({
  rooms,
  reservations,
  incidents,
  seats,
  onNavigate,
}: {
  rooms: Room[];
  reservations: Reservation[];
  incidents: Incident[];
  seats: Seat[];
  onNavigate: (section: Section) => void;
}) {
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE").length;
  const pending = reservations.filter(
    (item) => item.status === "PENDING",
  ).length;
  const open = incidents.filter((item) => item.status !== "RESOLVED").length;
  const available = seats.filter((seat) => seat.status === "AVAILABLE").length;
  const metrics = [
    {
      label: "Total rooms",
      value: rooms.length,
      sub: `${activeRooms} active rooms`,
      icon: DoorOpen,
      tone: "red",
      section: "rooms" as Section,
    },
    {
      label: "Reservations",
      value: reservations.length,
      sub: `${pending} awaiting review`,
      icon: CalendarDays,
      tone: "blue",
      section: "reservations" as Section,
    },
    {
      label: "Available seats",
      value: available,
      sub: `of ${seats.length} in demo room`,
      icon: UsersRound,
      tone: "green",
      section: "seats" as Section,
    },
    {
      label: "Open incidents",
      value: open,
      sub: "Needs your attention",
      icon: Wrench,
      tone: "amber",
      section: "incidents" as Section,
    },
  ];
  return (
    <>
      <div className="metric-grid">
        {metrics.map((metric) => (
          <button
            className="metric-card"
            key={metric.label}
            onClick={() => onNavigate(metric.section)}
          >
            <span className={`metric-icon tone-${metric.tone}`}>
              <metric.icon size={20} />
            </span>
            <span className="metric-arrow">
              <ArrowUpRight size={17} />
            </span>
            <span className="metric-label">{metric.label}</span>
            <strong>{metric.value.toString().padStart(2, "0")}</strong>
            <span className="metric-sub">
              <span className={`metric-small-dot dot-${metric.tone}`} />{" "}
              {metric.sub}
            </span>
          </button>
        ))}
      </div>
      <div className="overview-grid">
        <div className="admin-panel recent-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">LATEST ACTIVITY</span>
              <h2>Recent reservations</h2>
              <p>Keep track of incoming room requests.</p>
            </div>
            <button
              className="view-all"
              onClick={() => onNavigate("reservations")}
            >
              View all <ArrowRight size={16} />
            </button>
          </div>
          <div className="table-scroll">
            <table className="admin-table recent-table">
              <thead>
                <tr>
                  <th>BOOKING</th>
                  <th>ROOM</th>
                  <th>TIME</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {reservations.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong className="cell-strong">#{item.id}</strong>
                      <small className="cell-sub">User #{item.userId}</small>
                    </td>
                    <td>
                      <span className="room-code-chip">
                        {item.roomCode ??
                          rooms.find((room) => room.id === item.roomId)?.code}
                      </span>
                    </td>
                    <td>
                      <strong className="cell-strong">
                        {dateTime(item.startTime)}
                      </strong>
                      <small className="cell-sub">
                        {timeOnly(item.startTime)} – {timeOnly(item.endTime)}
                      </small>
                    </td>
                    <td>
                      <span className={statusClass(item.status)}>
                        <i />
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="overview-side">
          <div className="admin-panel attention-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">ACTION CENTER</span>
                <h2>Needs attention</h2>
              </div>
            </div>
            <button
              className="attention-item"
              onClick={() => onNavigate("reservations")}
            >
              <span className="attention-icon tone-blue">
                <CalendarDays size={19} />
              </span>
              <span>
                <strong>Pending reservations</strong>
                <small>{pending} requests waiting for approval</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <button
              className="attention-item"
              onClick={() => onNavigate("incidents")}
            >
              <span className="attention-icon tone-amber">
                <CircleAlert size={19} />
              </span>
              <span>
                <strong>Unresolved incidents</strong>
                <small>{open} facility issues to review</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <button
              className="attention-item"
              onClick={() => onNavigate("rooms")}
            >
              <span className="attention-icon tone-red">
                <Wrench size={19} />
              </span>
              <span>
                <strong>Rooms in maintenance</strong>
                <small>{rooms.length - activeRooms} rooms unavailable</small>
              </span>
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="overview-tip">
            <span className="tip-symbol">
              <ShieldCheck size={22} />
            </span>
            <span className="panel-kicker">CAMPUS OPERATIONS</span>
            <h3>One place for every space.</h3>
            <p>
              Review reservations, maintain rooms, and keep your campus running
              smoothly.
            </p>
            <button onClick={() => onNavigate("rooms")}>
              Explore rooms <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ListToolbar({
  query,
  setQuery,
  filter,
  setFilter,
  options,
  placeholder,
  count,
}: {
  query: string;
  setQuery: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  options: string[];
  placeholder: string;
  count: number;
}) {
  return (
    <div className="list-toolbar">
      <div className="search-box">
        <Search size={17} />
        <input
          aria-label="Search records"
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="toolbar-side">
        <span className="result-count">{count} records</span>
        <span className="select-wrap">
          <Settings2 size={16} />
          <select
            aria-label="Filter by status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All statuses" : option.replace("_", " ")}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </span>
      </div>
    </div>
  );
}
function EmptyTable() {
  return (
    <div className="empty-table">
      <Search size={24} />
      <strong>No matching records</strong>
      <span>Try a different search or status filter.</span>
    </div>
  );
}
function TableFooter({ count }: { count: number }) {
  return (
    <div className="table-footer">
      <span>
        Showing {count} of {count} records
      </span>
      <span className="pagination">
        <button disabled aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <button className="current-page" aria-label="Page 1">
          1
        </button>
        <button disabled aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </span>
    </div>
  );
}

function SeatSection({
  rooms,
  seats,
  selectedRoom,
  setSelectedRoom,
  onChange,
}: {
  rooms: Room[];
  seats: Seat[];
  selectedRoom: number;
  setSelectedRoom: (id: number) => void;
  onChange: (id: number, status: Seat["status"]) => void;
}) {
  const room = rooms.find((item) => item.id === selectedRoom);
  const roomSeats = seats.filter((seat) => seat.roomId === selectedRoom);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const activeSeat = roomSeats.find((seat) => seat.id === selectedSeat);
  return (
    <>
      <div className="seat-toolbar">
        <div>
          <span className="panel-kicker">SELECT A ROOM</span>
          <div className="select-wrap room-select">
            <DoorOpen size={17} />
            <select
              aria-label="Choose room"
              value={selectedRoom}
              onChange={(event) => {
                setSelectedRoom(Number(event.target.value));
                setSelectedSeat(null);
              }}
            >
              {rooms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
        <span className="seat-hint">
          Demo seat data is available for B204 only.
        </span>
      </div>
      <div className="seat-summary">
        <div>
          <span>ROOM</span>
          <strong>{room?.code ?? "—"}</strong>
          <small>{room?.location}</small>
        </div>
        <div>
          <span>TOTAL SEATS</span>
          <strong>{roomSeats.length}</strong>
          <small>From SeatResponse records</small>
        </div>
        <div>
          <span>AVAILABLE</span>
          <strong>
            {roomSeats.filter((seat) => seat.status === "AVAILABLE").length}
          </strong>
          <small>Ready for booking</small>
        </div>
        <div>
          <span>UNAVAILABLE</span>
          <strong>
            {roomSeats.filter((seat) => seat.status !== "AVAILABLE").length}
          </strong>
          <small>Reserved, occupied or maintenance</small>
        </div>
      </div>
      <div className="admin-panel seat-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">ROOM LAYOUT</span>
            <h2>Seat overview</h2>
            <p>Select a seat to update its demo status.</p>
          </div>
          <span className={statusClass(room?.status ?? "ACTIVE")}>
            <i />
            {room?.status}
          </span>
        </div>
        {roomSeats.length ? (
          <>
            <div className="admin-seat-stage">FRONT OF ROOM</div>
            <div className="admin-seat-grid">
              {roomSeats.map((seat) => (
                <button
                  key={seat.id}
                  type="button"
                  className={`admin-seat seat-${seat.status.toLowerCase()} ${selectedSeat === seat.id ? "is-selected" : ""}`}
                  onClick={() => setSelectedSeat(seat.id)}
                  aria-label={`Seat ${seat.seatNumber}, ${seat.status.toLowerCase()}`}
                  aria-pressed={selectedSeat === seat.id}
                >
                  {String(seat.seatNumber).padStart(2, "0")}
                </button>
              ))}
            </div>
            <div className="seat-panel-bottom">
              <div className="seat-legend-admin">
                {(
                  ["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE"] as const
                ).map((status) => (
                  <span key={status}>
                    <i className={`seat-dot seat-${status.toLowerCase()}`} />
                    {status}
                  </span>
                ))}
              </div>
              {activeSeat && (
                <div className="seat-editor">
                  <strong>Seat #{activeSeat.seatNumber}</strong>
                  <select
                    aria-label={`Status for seat ${activeSeat.seatNumber}`}
                    value={activeSeat.status}
                    onChange={(event) =>
                      onChange(
                        activeSeat.id,
                        event.target.value as Seat["status"],
                      )
                    }
                  >
                    {(
                      [
                        "AVAILABLE",
                        "RESERVED",
                        "OCCUPIED",
                        "MAINTENANCE",
                      ] as const
                    ).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-table">
            <UsersRound size={27} />
            <strong>No seat records for {room?.code}</strong>
            <span>Only room B204 has sample SeatResponse data.</span>
          </div>
        )}
      </div>
    </>
  );
}
