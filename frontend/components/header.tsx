"use client";

import { useState } from "react";
import { ArrowUpRight, Building2, Menu, X } from "lucide-react";

const links = [
  ["Tra cứu phòng", "#tra-cuu"],
  ["Không gian học tập", "#khong-gian"],
  ["Quy trình đặt chỗ", "#quy-trinh"],
  ["Bản đồ khuôn viên", "#ban-do"],
  ["Hỗ trợ", "#ho-tro"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner container">
        <a
          className="brand"
          href="#top"
          aria-label="TDTU Smart Campus - về đầu trang"
        >
          <span className="brand-icon">
            <Building2 size={23} strokeWidth={1.8} />
          </span>
          <span className="brand-name">
            TDTU <strong>Smart Campus</strong>
            <small>KHÔNG GIAN CHO TƯƠNG LAI</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {links.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="admin-demo-link" href="/admin">
            Admin demo
          </a>
          <span className="system-status">
            <span className="status-dot" /> Hệ thống sẵn sàng
          </span>
          <a
            className="portal-button"
            href="https://stdportal.tdtu.edu.vn/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Đăng nhập Portal <ArrowUpRight size={16} />
          </a>
        </div>
        <button
          className="menu-button"
          type="button"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <nav className="mobile-nav" aria-label="Điều hướng di động">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <a href="/admin">Admin demo</a>
          <a
            href="https://stdportal.tdtu.edu.vn/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Đăng nhập Portal ↗
          </a>
        </nav>
      )}
    </header>
  );
}
