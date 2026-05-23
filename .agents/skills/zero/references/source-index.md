# Zero Source Docs Index

Snapshot source: `rocicorp/zero-docs` commit `21a131c2e089915fb9eea692f07cd37593d78186`.

Use this file to choose which raw MDX file in `references/source-docs/` to read for exact current details. Public URL pattern: `https://zero.rocicorp.dev/docs/<slug>`.

## agents.mdx
- Title: Agent Support
- Words: 65
- URL: https://zero.rocicorp.dev/docs/agents
- Headings:
  - `## Options`

## auth.mdx
- Title: Authentication
- Words: 2989
- URL: https://zero.rocicorp.dev/docs/auth
- Headings:
  - `## Set userID on Client`
  - `## Define the `Context` Type`
  - `## Send Credentials`
  - `### Cookies`
  - `### Cookie Deployment`
  - `### Tokens`
  - `## Implement API Endpoints`
  - `### Query`
  - `### Mutate`
  - `## Updating Tokens`
  - `## Auth Failure and Refresh`
  - `## Permission Patterns`
  - `### Read Permissions`
  - `#### Only Owned Rows`
  - `#### Owned or Shared Rows`
  - `#### Owned Rows or All if Admin`
  - `#### Deny by Returning No Rows`
  - `### Write Permissions`
  - `#### Enforce Ownership`
  - `#### Edit Owned Rows`
  - `#### Edit Owned or Shared Rows`
  - `#### Edit Owned or All if Admin`
  - `## Logging Out`

## cloud-zero.mdx
- Title: Deploy on Cloud Zero
- Words: 62
- URL: https://zero.rocicorp.dev/docs/cloud-zero

## community.mdx
- Title: From the Community
- Words: 136
- URL: https://zero.rocicorp.dev/docs/community
- Headings:
  - `## UI Frameworks`
  - `## Miscellaneous`

## connecting-to-postgres.mdx
- Title: Connecting to Postgres
- Words: 1544
- URL: https://zero.rocicorp.dev/docs/connecting-to-postgres
- Headings:
  - `## Event Triggers`
  - `## Configuration`
  - `### WAL Level`
  - `### Bounding WAL Size`
  - `## Provider-Specific Notes`
  - `### PlanetScale for Postgres`
  - `### Neon`
  - `#### Logical Replication`
  - `#### Branching`
  - `### Fly.io`
  - `#### Networking`
  - `#### Permissions`
  - `#### Pooling`
  - `### Supabase`
  - `#### Publication Changes`
  - `#### IPv4`
  - `### Render`
  - `### Google Cloud SQL`
  - `## Schema Change Hooks`

## connection.mdx
- Title: Connection Status
- Words: 1314
- URL: https://zero.rocicorp.dev/docs/connection
- Headings:
  - `## Overview`
  - `## Usage`
  - `## Offline`
  - `## Offline UI`
  - `## Details`
  - `### Connecting`
  - `### Connected`
  - `### Disconnected`
  - `### Error`
  - `### Needs-Auth`
  - `### Closed`
  - `## Why Zero Doesn't Support Offline Writes`
  - `### Example`
  - `### Tradeoffs`
  - `### Zero's Position`

## debug/analyze-query-cli.mdx
- Title: Analyze Query CLI
- Words: 608
- URL: https://zero.rocicorp.dev/docs/debug/analyze-query-cli
- Headings:
  - `## Set Up`
  - `## Run ZQL Queries`
  - `## Production Use`
  - `## Env Var Shorthand`
  - `## Other Input Modes`
  - `## Output`
  - `## Optional Output`

## debug/inspector.mdx
- Title: Inspector
- Words: 1249
- URL: https://zero.rocicorp.dev/docs/debug/inspector
- Headings:
  - `## Accessing the Inspector`
  - `## Clients and Groups`
  - `## Queries`
  - `## Analyzing Queries`
  - `## Interpreting Query Analysis`
  - `## Viewing SQLite Plans`
  - `## Viewing Zero Plans`
  - `## Analyzing Arbitrary ZQL`
  - `## Table Data`
  - `## Server Version`

## debug/query-asts.mdx
- Title: Query ASTs
- Words: 181
- URL: https://zero.rocicorp.dev/docs/debug/query-asts

## debug/replication.mdx
- Title: Replication
- Words: 310
- URL: https://zero.rocicorp.dev/docs/debug/replication
- Headings:
  - `## Resetting`
  - `## Inspecting`
  - `## Miscellaneous`

## debug/slow-queries.mdx
- Title: Slow Queries
- Words: 390
- URL: https://zero.rocicorp.dev/docs/debug/slow-queries
- Headings:
  - `## Analyze Queries`
  - `## Check `ttl``
  - `## Locality`
  - `## Check Storage`
  - `## /statz`

## debug/zero-out.mdx
- Title: zero-out
- Words: 63
- URL: https://zero.rocicorp.dev/docs/debug/zero-out

## deprecated/ad-hoc-queries.mdx
- Title: Ad-Hoc Queries (Deprecated)
- Words: 101
- URL: https://zero.rocicorp.dev/docs/deprecated/ad-hoc-queries
- Headings:
  - `## Overview`

## deprecated/crud-mutators.mdx
- Title: CRUD Mutators (Deprecated)
- Words: 122
- URL: https://zero.rocicorp.dev/docs/deprecated/crud-mutators
- Headings:
  - `## Overview`

## deprecated/rls-permissions.mdx
- Title: RLS Permissions (Deprecated)
- Words: 1650
- URL: https://zero.rocicorp.dev/docs/deprecated/rls-permissions
- Headings:
  - `## Define Permissions`
  - `## Access is Denied by Default`
  - `## Permission Evaluation`
  - `## Permission Deployment`
  - `## Rules`
  - `## Select Permissions`
  - `## Insert Permissions`
  - `## Update Permissions`
  - `## Delete Permissions`
  - `## Permissions Based on Auth Data`
  - `## Debugging`
  - `### Read Permissions`
  - `### Write Permissions`

## install.mdx
- Title: Install Zero
- Words: 2922
- URL: https://zero.rocicorp.dev/docs/install
- Headings:
  - `## Integrate Zero`
  - `### Set Up Your Database`
  - `### Install Zero`
  - `### Set Up Your Zero Schema`
  - `### Set Up the Zero Client`
  - `## Sync Data`
  - `### Define Query`
  - `### Add Query Endpoint`
  - `### Invoke Query`
  - `### More about Queries`
  - `## Mutate Data`
  - `### Define Mutators`
  - `### Add Mutate Endpoint`
  - `### Invoke Mutators`
  - `### More about Mutators`

## introduction.mdx
- Title: Welcome to Zero
- Words: 81
- URL: https://zero.rocicorp.dev/docs/introduction

## mutators.mdx
- Title: Mutators
- Description: Writing Data
- Words: 4529
- URL: https://zero.rocicorp.dev/docs/mutators
- Headings:
  - `## Architecture`
  - `### Life of a Mutation`
  - `## Defining Mutators`
  - `### Basics`
  - `### Writing Data`
  - `#### Insert`
  - `#### Upsert`
  - `#### Update`
  - `#### Delete`
  - `### Arguments`
  - `### Reading Data`
  - `### Context`
  - `### Mutator Registries`
  - `### Mutator Names`
  - `### mutators.ts`
  - `## Registration`
  - `## Server Setup`
  - `### Registering the Endpoint`
  - `### Implementing the Endpoint`
  - `### Handling Errors`
  - `### Custom Mutate URL`
  - `### URL Patterns`
  - `### Server-Specific Code`
  - `## Running Mutators`
  - ... 5 more

## open-source.mdx
- Title: Zero is Open Source Software
- Words: 123
- URL: https://zero.rocicorp.dev/docs/open-source
- Headings:
  - `## Business Model`

## otel.mdx
- Title: OpenTelemetry
- Words: 913
- URL: https://zero.rocicorp.dev/docs/otel
- Headings:
  - `## Grafana Cloud Walkthrough`
  - `## Distributed Tracing`
  - `## Metrics Reference`
  - `### zero.server`
  - `### zero.replica`
  - `### zero.replication`
  - `### zero.sync`
  - `### zero.mutation`

## postgres-support.mdx
- Title: Supported Postgres Features
- Words: 1167
- URL: https://zero.rocicorp.dev/docs/postgres-support
- Headings:
  - `## Object Names`
  - `## Object Types`
  - `## Column Types`
  - `## Column Defaults`
  - `## IDs`
  - `## Primary Keys`
  - `## Limiting Replication`
  - `### zero-cache replication`
  - `### Browser client replication`
  - `## Schema changes`

## previews.mdx
- Title: Previews
- Description: Per-Branch Preview URLs
- Words: 331
- URL: https://zero.rocicorp.dev/docs/previews
- Headings:
  - `## Overview`
  - `## Configure Allowed Endpoint Patterns`
  - `## Choose Endpoint URLs in the Client`
  - `## Schema Changes in Previews`

## queries.mdx
- Title: Queries
- Description: Reading and Syncing Data
- Words: 4201
- URL: https://zero.rocicorp.dev/docs/queries
- Headings:
  - `## Architecture`
  - `### Life of a Query`
  - `## Defining Queries`
  - `### Basics`
  - `### Arguments`
  - `### Query Registries`
  - `### Query Names`
  - `### Context`
  - `### queries.ts`
  - `## Server Setup`
  - `### Registering the Endpoint`
  - `### Implementing the Endpoint`
  - `### Custom Query URL`
  - `### URL Patterns`
  - `## Running Queries`
  - `### Reactively`
  - `### Conditionally`
  - `### Once`
  - `### For Preloading`
  - `## Missing Data`
  - `## Partial Data`
  - `## Handling Errors`
  - `## Granular Updates`
  - `## Query Caching`
  - ... 7 more

## quickstart.mdx
- Title: Quickstart
- Words: 237
- URL: https://zero.rocicorp.dev/docs/quickstart
- Headings:
  - `## hello-zero-solid`
  - `## hello-zero-cf`
  - `## hello-zero`

## react-native.mdx
- Title: React Native
- Words: 158
- URL: https://zero.rocicorp.dev/docs/react-native

## react.mdx
- Title: React
- Words: 447
- URL: https://zero.rocicorp.dev/docs/react
- Headings:
  - `## Setup`
  - `## Usage`
  - `## Suspense`
  - `## Examples`

## release-notes/0.1.mdx
- Title: Zero 0.1
- Description: First Release
- Words: 194
- URL: https://zero.rocicorp.dev/docs/release-notes/0.1
- Headings:
  - `## Breaking changes`
  - `## Features`
  - `## Source tree fixes`

## release-notes/0.10.mdx
- Title: Zero 0.10
- Description: Remove Top-Level Await
- Words: 53
- URL: https://zero.rocicorp.dev/docs/release-notes/0.10
- Headings:
  - `## Install`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.11.mdx
- Title: Zero 0.11
- Description: Windows
- Words: 183
- URL: https://zero.rocicorp.dev/docs/release-notes/0.11
- Headings:
  - `## Install`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.12.mdx
- Title: Zero 0.12
- Description: Circular Relationships
- Words: 309
- URL: https://zero.rocicorp.dev/docs/release-notes/0.12
- Headings:
  - `## Install`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.13.mdx
- Title: Zero 0.13
- Description: Multinode and SST
- Words: 160
- URL: https://zero.rocicorp.dev/docs/release-notes/0.13
- Headings:
  - `## Install`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.14.mdx
- Title: Zero 0.14
- Description: Name Mapping and Multiple Schemas
- Words: 117
- URL: https://zero.rocicorp.dev/docs/release-notes/0.14
- Headings:
  - `## Install`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.15.mdx
- Title: Zero 0.15
- Description: Live Permission Updates
- Words: 466
- URL: https://zero.rocicorp.dev/docs/release-notes/0.15
- Headings:
  - `## Install`
  - `## Upgrade Guide`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.16.mdx
- Title: Zero 0.16
- Description: Lambda-Based Permission Deployment
- Words: 273
- URL: https://zero.rocicorp.dev/docs/release-notes/0.16
- Headings:
  - `## Install`
  - `## Upgrading`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.17.mdx
- Title: Zero 0.17
- Description: Background Queries
- Words: 415
- URL: https://zero.rocicorp.dev/docs/release-notes/0.17
- Headings:
  - `## Install`
  - `## Upgrading`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.18.mdx
- Title: Zero 0.18
- Description: Custom Mutators
- Words: 383
- URL: https://zero.rocicorp.dev/docs/release-notes/0.18
- Headings:
  - `## Install`
  - `## Upgrading`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.19.mdx
- Title: Zero 0.19
- Description: Many, many bugfixes and cleanups
- Words: 654
- URL: https://zero.rocicorp.dev/docs/release-notes/0.19
- Headings:
  - `## Install`
  - `## Upgrading`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.2.mdx
- Title: Zero 0.2
- Description: Skip Mode and Compound PKs
- Words: 259
- URL: https://zero.rocicorp.dev/docs/release-notes/0.2
- Headings:
  - `## Breaking changes`
  - `## Features`
  - `## Fixes`
  - `## Docs`
  - `## Source tree fixes`
  - `## zbugs`

## release-notes/0.20.mdx
- Title: Zero 0.20
- Description: Full Supabase support, performance improvements
- Words: 611
- URL: https://zero.rocicorp.dev/docs/release-notes/0.20
- Headings:
  - `## Install`
  - `## Upgrading`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.21.mdx
- Title: Zero 0.21
- Description: Postgres arrays, TanStack sample, automated React lifecycle management
- Words: 564
- URL: https://zero.rocicorp.dev/docs/release-notes/0.21
- Headings:
  - `## Install`
  - `## Upgrading`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.22.mdx
- Title: Zero 0.22
- Description: Simplified TTLs, fine-grained SolidJS, and more
- Words: 641
- URL: https://zero.rocicorp.dev/docs/release-notes/0.22
- Headings:
  - `## Install`
  - `## Upgrading`
  - `### How TTLs Used to Work`
  - `### How TTLs Work Now`
  - `### Using New TTLs`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.23.mdx
- Title: Zero 0.23
- Description: Synced Queries and React Native Support
- Words: 478
- URL: https://zero.rocicorp.dev/docs/release-notes/0.23
- Headings:
  - `## Install`
  - `## Upgrading`
  - `## Features`
  - `## Fixes`
  - `## zbugs`
  - `## Breaking Changes`

## release-notes/0.24.mdx
- Title: Zero 0.24
- Description: Join Flipping, Cookie Auth, Previews
- Words: 821
- URL: https://zero.rocicorp.dev/docs/release-notes/0.24
- Headings:
  - `## Installation`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`
  - `## Example Upgrades`

## release-notes/0.25.mdx
- Title: Zero 0.25
- Description: DX Overhaul, Query Planning
- Words: 1483
- URL: https://zero.rocicorp.dev/docs/release-notes/0.25
- Headings:
  - `## Installation`
  - `## Overview`
  - `## Upgrading`
  - `## Features`
  - `## Performance`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.26.mdx
- Title: Zero 0.26
- Description: Schema Backfill and Scalar Subqueries
- Words: 1047
- URL: https://zero.rocicorp.dev/docs/release-notes/0.26
- Headings:
  - `## Installation`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.3.mdx
- Title: Zero 0.3
- Description: Schema Migrations and Write Perms
- Words: 407
- URL: https://zero.rocicorp.dev/docs/release-notes/0.3
- Headings:
  - `## Install`
  - `## Breaking changes`
  - `## Features`
  - `## Fixes`
  - `## Docs`
  - `## zbugs`

## release-notes/0.4.mdx
- Title: Zero 0.4
- Description: Compound Filters
- Words: 174
- URL: https://zero.rocicorp.dev/docs/release-notes/0.4
- Headings:
  - `## Install`
  - `## Breaking changes`
  - `## Added `or` , `and` , and `not` to ZQL ([documentation](/docs/zql)).`
  - `## Fixes`
  - `## Docs`
  - `## zbugs`

## release-notes/0.5.mdx
- Title: Zero 0.5
- Description: JSON Columns
- Words: 119
- URL: https://zero.rocicorp.dev/docs/release-notes/0.5
- Headings:
  - `## Install`
  - `## Breaking changes`
  - `## Features`
  - `## Fixes`
  - `## Docs`
  - `## zbugs`

## release-notes/0.6.mdx
- Title: Zero 0.6
- Description: Relationship FIlters
- Words: 534
- URL: https://zero.rocicorp.dev/docs/release-notes/0.6
- Headings:
  - `## Install`
  - `## Upgrade Guide`
  - `## Breaking Changes`
  - `## Features`
  - `## zbugs`
  - `## Docs`

## release-notes/0.7.mdx
- Title: Zero 0.7
- Description: Read Permissions and Docker
- Words: 483
- URL: https://zero.rocicorp.dev/docs/release-notes/0.7
- Headings:
  - `## Install`
  - `## Features`
  - `## Breaking Changes`
  - `## zbugs`
  - `## Docs`

## release-notes/0.8.mdx
- Title: Zero 0.8
- Description: Schema Autobuild, Result Types, and Enums
- Words: 315
- URL: https://zero.rocicorp.dev/docs/release-notes/0.8
- Headings:
  - `## Install`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/0.9.mdx
- Title: Zero 0.9
- Description: JWK Support
- Words: 184
- URL: https://zero.rocicorp.dev/docs/release-notes/0.9
- Headings:
  - `## Install`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/1.0.mdx
- Title: Zero 1.0
- Description: First Stable Release
- Words: 207
- URL: https://zero.rocicorp.dev/docs/release-notes/1.0
- Headings:
  - `## Installation`
  - `## Overview`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/1.1.mdx
- Title: Zero 1.1
- Description: Replication Monitoring
- Words: 57
- URL: https://zero.rocicorp.dev/docs/release-notes/1.1
- Headings:
  - `## Installation`
  - `## Features`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/1.2.mdx
- Title: Zero 1.2
- Description: IVM Performance and Bug Fixes
- Words: 233
- URL: https://zero.rocicorp.dev/docs/release-notes/1.2
- Headings:
  - `## Installation`
  - `## Features`
  - `## Performance`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/1.3.mdx
- Title: Zero 1.3
- Description: Faster Initial Sync and Other Perf Improvements
- Words: 200
- URL: https://zero.rocicorp.dev/docs/release-notes/1.3
- Headings:
  - `## Installation`
  - `## Features`
  - `## Performance`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/1.4.mdx
- Title: Zero 1.4
- Description: Performance and Reliability Improvements
- Words: 738
- URL: https://zero.rocicorp.dev/docs/release-notes/1.4
- Headings:
  - `## Installation`
  - `## Upgrading`
  - `### userID: "anon"`
  - `## Features`
  - `## Performance`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/1.5.mdx
- Title: Zero 1.5
- Description: Schema Change Improvements and Client Group Auth
- Words: 507
- URL: https://zero.rocicorp.dev/docs/release-notes/1.5
- Headings:
  - `## Installation`
  - `## Upgrading`
  - `### Authenticated Client Groups`
  - `### Deploy Order`
  - `## Features`
  - `## Performance`
  - `## Fixes`
  - `## Breaking Changes`

## release-notes/index.mdx
- Title: Release Notes
- Words: 381
- URL: https://zero.rocicorp.dev/docs/release-notes/index

## reporting-bugs.mdx
- Title: Reporting Bugs
- Words: 62
- URL: https://zero.rocicorp.dev/docs/reporting-bugs
- Headings:
  - `## zbugs`
  - `## Discord`

## rest.mdx
- Title: REST
- Description: Creating REST APIs for Zero Applications
- Words: 349
- URL: https://zero.rocicorp.dev/docs/rest
- Headings:
  - `## Pattern`
  - `## TanStack Start Example`
  - `## OpenAPI Generation`
  - `## Full Working Example`

## roadmap.mdx
- Title: Roadmap
- Words: 211
- URL: https://zero.rocicorp.dev/docs/roadmap
- Headings:
  - `## Q4 2025`
  - `## Beyond`

## samples.mdx
- Title: Samples
- Words: 324
- URL: https://zero.rocicorp.dev/docs/samples
- Headings:
  - `## Gigabugs`
  - `## ztunes`
  - `## zslack`
  - `## onboarding`

## schema.mdx
- Title: Zero Schema
- Words: 2533
- URL: https://zero.rocicorp.dev/docs/schema
- Headings:
  - `## Generating from Database`
  - `## Writing by Hand`
  - `### Table Schemas`
  - `#### Name Mapping`
  - `#### Multiple Schemas`
  - `#### Optional Columns`
  - `#### Enumerations`
  - `#### Custom JSON Types`
  - `#### Compound Primary Keys`
  - `### Relationships`
  - `#### Many-to-Many Relationships`
  - `#### Compound Keys Relationships`
  - `#### Circular Relationships`
  - `### Database Schemas`
  - `### Register Schema Type`
  - `## Schema Changes`
  - `### Development`
  - `### Production`
  - `### Expand Changes`
  - `### Contract Changes`
  - `### Compound Changes`
  - `### Examples`
  - `#### Adding a Column`
  - `#### Removing a Column`
  - ... 5 more

## self-host.mdx
- Title: Self-Hosting Zero
- Words: 2942
- URL: https://zero.rocicorp.dev/docs/self-host
- Headings:
  - `## Minimum Viable Strategy`
  - `## Maximal Strategy`
  - `## Replica Lifecycle`
  - `## Performance`
  - `### Hydration`
  - `### IVM advancement`
  - `### System-level`
  - `## Networking`
  - `### Sticky Sessions`
  - `## Rolling Updates`
  - `### Client/Server Version Compatibility`
  - `### Configuration`

## server-zql.mdx
- Title: ZQL on the Server
- Words: 993
- URL: https://zero.rocicorp.dev/docs/server-zql
- Headings:
  - `## Creating a Database`
  - `### Custom Database`
  - `## Running ZQL`
  - `## SSR`

## solidjs.mdx
- Title: SolidJS
- Words: 351
- URL: https://zero.rocicorp.dev/docs/solidjs
- Headings:
  - `## Setup`
  - `## Usage`
  - `## Examples`

## status.mdx
- Title: Project Status
- Words: 195
- URL: https://zero.rocicorp.dev/docs/status
- Headings:
  - `## Breaking Changes`
  - `## Roadmap`
  - `### 2026`
  - `### Soon`

## sync.mdx
- Title: What is Sync?
- Description: A Slightly Opinionated Tour of the Space
- Words: 724
- URL: https://zero.rocicorp.dev/docs/sync
- Headings:
  - `## Problem`
  - `## Solution`
  - `## History of Sync`

## tutorial.mdx
- Title: Tutorial
- Words: 3407
- URL: https://zero.rocicorp.dev/docs/tutorial
- Headings:
  - `## Setup`
  - `### Create a Project`
  - `### Set Up Your Database`
  - `### Install and Run Zero-Cache`
  - `## Integrate Zero`
  - `### Set Up Your Zero Schema`
  - `### Set Up the Zero Client`
  - `## Sync Data`
  - `### Define Query`
  - `### Add Query Endpoint`
  - `### Invoke Query`
  - `## Mutate Data`
  - `### Define Mutators`
  - `### Add Mutate Endpoint`
  - `### Invoke Mutators`
  - `## Next Steps`

## when-to-use.mdx
- Title: When To Use Zero
- Description: And When Not To – A Quick Guide
- Words: 659
- URL: https://zero.rocicorp.dev/docs/when-to-use
- Headings:
  - `## Zero Might be a Good Fit`
  - `### You want to sync only a small subset of data to client`
  - `### You need fine-grained read or write permissions`
  - `### You are building a traditional client-server web app`
  - `### You use PostgreSQL`
  - `### Your app is broadly "like Linear"`
  - `### Interaction performance is very important to you`
  - `## Zero Might Not be a Good Fit`
  - `### You need the privacy or data ownership benefits of local-first`
  - `### You need to support offline writes or long periods offline`
  - `### You are building a native mobile app`
  - `### The total backend dataset is > ~100GB`
  - `## Zero Might Not be a Good Fit **Yet**`
  - `## Alternatives`

## zero-cache-config.mdx
- Title: zero-cache Config
- Words: 4705
- URL: https://zero.rocicorp.dev/docs/zero-cache-config
- Headings:
  - `## Required Flags`
  - `### Upstream DB`
  - `### Admin Password`
  - `## Optional Flags`
  - `### App ID`
  - `### App Publications`
  - `### Auth Revalidate Interval Seconds`
  - `### Auth Retransform Interval Seconds`
  - `### Auto Reset`
  - `### Change DB`
  - `### Change Max Connections`
  - `### Change Streamer Back Pressure Limit Heap Proportion`
  - `### Change Streamer Flow Control Consensus Padding Seconds`
  - `### Change Streamer Mode`
  - `### Change Streamer Port`
  - `### Change Streamer Startup Delay (ms)`
  - `### Change Streamer URI`
  - `### CVR DB`
  - `### CVR Garbage Collection Inactivity Threshold Hours`
  - `### CVR Garbage Collection Initial Batch Size`
  - `### CVR Garbage Collection Initial Interval Seconds`
  - `### CVR Max Connections`
  - `### Enable Query Planner`
  - `### Enable CRUD Mutations`
  - ... 55 more

## zql.mdx
- Title: ZQL
- Description: Zero Query Language
- Words: 2197
- URL: https://zero.rocicorp.dev/docs/zql
- Headings:
  - `## Create a Builder`
  - `## Select`
  - `## Ordering`
  - `## Limit`
  - `## Paging`
  - `## Getting a Single Result`
  - `## Relationships`
  - `### Refining Relationships`
  - `### Nested Relationships`
  - `## Where`
  - `### Comparison Operators`
  - `### Equals is the Default Comparison Operator`
  - `### Comparing to `null``
  - `### Comparing to `undefined``
  - `### Compound Filters`
  - `### Comparing Literal Values`
  - `### Relationship Filters`
  - `## Type Helpers`
  - `## Planning`
  - `### Inspecting Query Plans`
  - `### Manually Flipping Joins`
  - `## Scalar Subqueries`
  - `### Why It Matters`
  - `### Trade-offs`
  - ... 1 more
