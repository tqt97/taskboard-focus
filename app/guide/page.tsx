import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Cloud,
  Keyboard,
  ListChecks,
  LockKeyhole,
  Search,
  ShieldCheck,
} from "lucide-react";
import styles from "./guide.module.css";

export const metadata: Metadata = {
  title: "Hướng dẫn sử dụng | Taskboard",
  description: "Hướng dẫn nhanh để tạo, tổ chức và bảo vệ dữ liệu trong Taskboard.",
  robots: { index: false, follow: false },
};

const steps = [
  ["01", "Ghi nhanh", "Nhấn N hoặc chọn Ghi nhanh để lưu một ý tưởng vào Bản nháp."],
  ["02", "Phân loại", "Mở Bản nháp, bổ sung trạng thái, người phụ trách và deadline."],
  [
    "03",
    "Thực hiện",
    "Theo dõi task trên Kanban; kéo thả hoặc dùng action trên từng thẻ.",
  ],
  ["04", "Hoàn tất", "Task đi qua flow Chưa làm → Đang làm → Chờ review → Hoàn tất."],
] as const;

const features = [
  {
    icon: Search,
    title: "Tìm và lọc",
    text: "Tìm theo mã, tiêu đề hoặc mô tả. Kết hợp trạng thái, ưu tiên, người phụ trách và deadline.",
  },
  {
    icon: CalendarRange,
    title: "Lịch & timeline",
    text: "Xem Dev up, Staging up, Release và Deadline. Chỉ Deadline có thể kéo để đổi ngày.",
  },
  {
    icon: ListChecks,
    title: "Checklist và quan hệ",
    text: "Chia task thành từng bước, gắn tài liệu/liên kết và theo dõi dependency ngay trong chi tiết task.",
  },
  {
    icon: Cloud,
    title: "Local-first và cloud",
    text: "Dữ liệu local được lưu trên trình duyệt. Khi cấu hình Supabase, bạn có thể đồng bộ workspace cloud.",
  },
] as const;

export default function GuidePage() {
  return (
    <main className={styles.page} id="guide-top">
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandIcon} aria-hidden="true">
              <BookOpen size={18} />
            </span>
            <span>Taskboard</span>
          </Link>
          <Link className={styles.backLink} href="/">
            <ArrowLeft size={15} /> Về workspace
          </Link>
        </header>

        <section className={styles.hero} aria-labelledby="guide-title">
          <p className={styles.eyebrow}>GET STARTED</p>
          <h1 className={styles.guideTitle} id="guide-title">
            Mở Taskboard là biết việc gì cần làm trước.
          </h1>
          <p className={styles.heroText}>
            Taskboard giúp bạn ghi nhanh việc cần làm, nhìn đúng ưu tiên và không bỏ lỡ
            những mốc phát hành quan trọng.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/tasks">
              Mở danh sách task <ArrowLeft className={styles.flipIcon} size={16} />
            </Link>
            <a className={styles.secondaryAction} href="#quick-start">
              Xem hướng dẫn nhanh
            </a>
          </div>
        </section>

        <section
          className={styles.quickStart}
          id="quick-start"
          aria-labelledby="quick-title"
        >
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>QUICK START</p>
            <h2 id="quick-title">Bốn bước để bắt đầu</h2>
          </div>
          <div className={styles.steps}>
            {steps.map(([number, title, text]) => (
              <article className={styles.step} key={number}>
                <span className={styles.stepNumber}>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.featureGrid} aria-label="Các tính năng chính">
          {features.map(({ icon: Icon, title, text }) => (
            <article className={styles.featureCard} key={title}>
              <span className={styles.featureIcon} aria-hidden="true">
                <Icon size={18} />
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <div className={styles.columns}>
          <section className={styles.guideCard} aria-labelledby="workflow-title">
            <div className={styles.cardHeading}>
              <CheckCircle2 size={18} />
              <h2 id="workflow-title">Workflow nên dùng</h2>
            </div>
            <ul>
              <li>
                Priority thể hiện thứ tự xử lý; Severity thể hiện mức độ ảnh hưởng.
              </li>
              <li>
                Task bị chặn sẽ nhớ trạng thái trước đó để quay lại sau khi gỡ chặn.
              </li>
              <li>
                Focus chỉ giữ task urgent/high, chờ review, chưa giao hoặc gần/quá hạn.
              </li>
              <li>
                Chọn nhiều để đổi trạng thái hoặc ưu tiên cho nhiều task cùng lúc.
              </li>
            </ul>
          </section>
          <section className={styles.guideCard} aria-labelledby="shortcuts-title">
            <div className={styles.cardHeading}>
              <Keyboard size={18} />
              <h2 id="shortcuts-title">Phím tắt hữu ích</h2>
            </div>
            <dl className={styles.shortcuts}>
              <div>
                <dt>N</dt>
                <dd>Ghi nhanh một task mới</dd>
              </div>
              <div>
                <dt>⌘ / Ctrl + K</dt>
                <dd>Focus ô tìm kiếm</dd>
              </div>
              <div>
                <dt>↑ / ↓</dt>
                <dd>Đưa task lên hoặc xuống trong cột</dd>
              </div>
              <div>
                <dt>Esc</dt>
                <dd>Đóng dialog và trả focus về nút mở</dd>
              </div>
            </dl>
          </section>
        </div>

        <section className={styles.safety} aria-labelledby="safety-title">
          <div className={styles.safetyIcon} aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className={styles.eyebrow}>DỮ LIỆU VÀ BẢO MẬT</p>
            <h2 id="safety-title">Đừng để một trình duyệt là bản sao duy nhất.</h2>
            <p>
              Vào <strong>Cài đặt → Dữ liệu</strong> để xuất JSON định kỳ. App giữ tối
              đa 7 bản sao tự động trên thiết bị; hãy tải backup ra nơi an toàn nếu cần
              chuyển máy.
            </p>
            <p>
              Screen lock là lớp khóa thao tác local, không thay thế Supabase Auth/RLS.
              Bạn có thể đổi passcode 6 số tại <strong>Cài đặt → Giao diện</strong>.
            </p>
          </div>
          <LockKeyhole className={styles.safetyLock} size={28} aria-hidden="true" />
        </section>

        <footer className={styles.footer}>
          <span>Taskboard · Cá nhân, rõ ràng, đúng hạn.</span>
          <Link href="/tasks">
            <ListChecks size={14} /> Mở taskboard
          </Link>
        </footer>
      </div>
      <a className={styles.scrollTop} href="#guide-top" aria-label="Lên đầu trang">
        <ArrowUp size={17} aria-hidden="true" />
      </a>
    </main>
  );
}
