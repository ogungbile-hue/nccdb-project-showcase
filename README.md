# NCCDB — Enterprise Construction Market Intelligence & Semantic Cost Indexing Engine

[![CI/CD Pipeline](https://github.com/ogungbile-hue/nccdb-project-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/ogungbile-hue/nccdb-project-showcase/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748.svg)

> **Architecture Showcase & Portfolio Release**  
> This public showcase demonstrates the architectural topology, data modeling, type-safe API contracts, and full React 19 frontend of the NCCDB platform. Core proprietary Google Sheets sync daemons and private credentials are stubbed with typed architectural interfaces. Full production implementations are available for engineering review upon request.

An enterprise-grade cost data platform and market intelligence engine built to eliminate price opacity and volatility across civil engineering and building construction supply chains. Features real-time statistical anomaly detection, 768-dimensional semantic entity reconciliation, and parametric unit-rate bill-of-quantities composition.

---

## Architectural Topology

```text
[Client Portals (Public Intelligence, Contributor QS, Admin Audit)]
                            │ (HTTPS / REST / JWT)
                            ▼
           [Express.js Gateway & RBAC Dispatcher]
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
[Anomaly Engine]   [Semantic AI Matcher]   [Cron Sync Daemon]
(Rolling baselines) (768-d text-embeddings) (Google Sheets API v4)
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │ (Prisma ORM / Connection Pooling)
                            ▼
      [PostgreSQL Database (Composite B-Tree Indexes, ACID)]
```

---

## Core Engineering Innovations

### 1. Statistical Anomaly & Outlier Quarantine Engine
To defend against volatile tender bids and fraudulent supplier quotes, incoming transactions are benchmarked against rolling historical baselines:
* **$\Delta \le 10\%$**: Standard moderation ingestion.
* **$10\% < \Delta \le 20\%$**: Soft-lock audit requiring structured justification metadata.
* **$\Delta > 20\%$**: Automatic quarantine to `FLAGGED` status with audit trail logging.
* **$\text{Price} \le 0$**: Hard rejection tagged as `CORRUPTED`.

### 2. Two-Phase Semantic Entity Reconciliation
Resolves informal, unstructured contractor and vendor trade nomenclature to canonical MasterFormat / Uniclass SKUs:
* **Phase 1 (Deterministic Cache)**: Rapid hash index evaluation over verified aliases in `material_aliases`.
* **Phase 2 (Semantic Vector Match)**: Computes 768-dimensional vector embeddings via Google GenAI (`text-embedding-004`) and performs cosine vector similarity matching against `master_materials` to achieve high-accuracy normalization.

### 3. Parametric Unit Rate Composition Pipeline
Dynamically builds and recalculates civil engineering work item rates during baseline material shifts:
$$\text{Unit Rate} = (\text{Material} + \text{Labor} + \text{Plant}) \times (1 + \text{Overhead \%}) \times (1 + \text{Profit \%})$$
Executed within atomic database transactions with fixed-point `DECIMAL(12,2)` precision to eliminate floating-point calculation drift.

### 4. Background Sync Daemon & Protected Sheet Feeds
Programmatically provisions locked vendor templates via Google Drive API v3 and Google Sheets API v4. A background daemon scheduled via `node-cron` ingests price updates at midnight with concurrency limits and automated retries.

---

## Verification & Testing

The repository maintains an automated unit and integration test suite:

```bash
# Execute test suite
npm test

# Run static type verification
npx tsc --noEmit
```

### Coverage Highlights
* **Anomaly Engine**: Complete branch coverage of variance thresholds.
* **Rate Build-Ups**: Numerical precision validation across edge-case markups.
* **Vector Similarity**: Mathematical verification of cosine similarity calculations.

---

## Getting Started

### Prerequisites
* Node.js >= 20.x
* PostgreSQL >= 15
* npm >= 10.x

### Installation & Environment Setup
```bash
# Clone the repository
git clone https://github.com/ogungbile-hue/nccdb-project-showcase.git
cd nccdb-project-showcase

# Install dependencies
npm ci

# Configure environment
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

---

## License
Proprietary — All rights reserved. Available for technical review and evaluation.
