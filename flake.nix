{
  description = "Zentro v2 — entorno de desarrollo reproducible (Bun + Postgres + Zero) vía Nix";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        postgresql = pkgs.postgresql_17;

        # Variables que apuntan Postgres a un data dir local al proyecto (sin Docker).
        # Coinciden con DATABASE_URL/ZERO_UPSTREAM_DB del .env (zentro:zentro@localhost:5432/zentro).
        pgEnv = ''
          export PGDATA="''${PGDATA:-$PWD/.nix/postgres/data}"
          export PGHOST="''${PGHOST:-$PWD/.nix/postgres/run}"
          export PGPORT="''${PGPORT:-5432}"
          export PGUSER="''${PGUSER:-zentro}"
          export PGPASSWORD="''${PGPASSWORD:-zentro}"
          export PGDATABASE="''${PGDATABASE:-zentro}"
        '';

        # ── Helpers de ciclo de vida de Postgres ──────────────────────────────
        pg-init = pkgs.writeShellApplication {
          name = "pg-init";
          runtimeInputs = [ postgresql ];
          text = ''
            ${pgEnv}
            if [ -d "$PGDATA" ] && [ -f "$PGDATA/PG_VERSION" ]; then
              echo "[pg-init] Postgres ya inicializado en $PGDATA"
              exit 0
            fi
            echo "[pg-init] Inicializando Postgres en $PGDATA …"
            mkdir -p "$PGDATA" "$PGHOST"
            pwfile="$(mktemp)"
            printf '%s' "$PGPASSWORD" > "$pwfile"
            initdb -U "$PGUSER" -A md5 --pwfile="$pwfile" --encoding=UTF8 --locale=C "$PGDATA" >/dev/null
            rm -f "$pwfile"
            {
              echo ""
              echo "# --- Zentro dev (gestionado por flake.nix) ---"
              echo "listen_addresses = 'localhost'"
              echo "port = $PGPORT"
              echo "unix_socket_directories = '$PGHOST'"
              # Zero necesita replicación lógica para espejar upstream a su réplica SQLite.
              echo "wal_level = logical"
              echo "max_wal_senders = 10"
              echo "max_replication_slots = 10"
            } >> "$PGDATA/postgresql.conf"
            echo "[pg-init] Listo (wal_level=logical)."
          '';
        };

        pg-start = pkgs.writeShellApplication {
          name = "pg-start";
          runtimeInputs = [
            postgresql
            pg-init
          ];
          text = ''
            ${pgEnv}
            pg-init
            pg_ctl -D "$PGDATA" -l "$PGDATA/postgres.log" -w start
            createdb -h localhost -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" 2>/dev/null \
              && echo "[pg-start] Base '$PGDATABASE' creada" \
              || echo "[pg-start] Base '$PGDATABASE' ya existe"
          '';
        };

        pg-stop = pkgs.writeShellApplication {
          name = "pg-stop";
          runtimeInputs = [ postgresql ];
          text = ''
            ${pgEnv}
            pg_ctl -D "$PGDATA" -m fast stop || true
          '';
        };

        pg-psql = pkgs.writeShellApplication {
          name = "pg-psql";
          runtimeInputs = [ postgresql ];
          text = ''
            ${pgEnv}
            exec psql -h localhost -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$@"
          '';
        };

        db-reset = pkgs.writeShellApplication {
          name = "db-reset";
          runtimeInputs = [
            postgresql
            pg-stop
          ];
          text = ''
            ${pgEnv}
            pg-stop
            echo "[db-reset] Borrando $PGDATA …"
            rm -rf "$PGDATA"
            echo "[db-reset] Hecho. Corre 'nix run' (o pg-start) para reinicializar."
          '';
        };

        # Reset total del entorno de datos: Postgres + réplica SQLite de Zero.
        env-reset = pkgs.writeShellApplication {
          name = "env-reset";
          runtimeInputs = [ db-reset ];
          text = ''
            ${pgEnv}
            db-reset
            echo "[env-reset] Borrando réplica de Zero (zero.db*) …"
            rm -f "$PWD"/zero.db "$PWD"/zero.db-*
            echo "[env-reset] Entorno de datos limpio. Corre 'nix run' para reconstruir."
          '';
        };

        helpers = [
          pg-init
          pg-start
          pg-stop
          pg-psql
          db-reset
          env-reset
        ];

        devTools = [
          pkgs.bun # runtime + gestor de paquetes
          # Node 24: zero-cache-dev corre bajo node y carga @rocicorp/zero-sqlite3
          # (módulo nativo, NODE_MODULE_VERSION 137 = Node 24). Debe coincidir el ABI.
          pkgs.nodejs_24 # también para `npx` (shadcn, react-doctor)
          postgresql # servidor + cliente (psql, pg_ctl, initdb, pg_isready, createdb)
          pkgs.process-compose # orquesta postgres + zero-cache + app
          pkgs.git
        ];

        # ── `nix run` → levanta todo el stack de dev ──────────────────────────
        up = pkgs.writeShellApplication {
          name = "zentro-up";
          runtimeInputs = devTools ++ helpers;
          text = ''
            ${pgEnv}
            if [ ! -d node_modules ]; then
              echo "[up] node_modules ausente → bun install"
              bun install
            fi
            pg-init
            exec process-compose up
          '';
        };
      in
      {
        apps = {
          default = {
            type = "app";
            program = "${up}/bin/zentro-up";
          };
          up = {
            type = "app";
            program = "${up}/bin/zentro-up";
          };
        };

        devShells.default = pkgs.mkShell {
          packages = devTools ++ helpers;
          shellHook = ''
            ${pgEnv}
            echo ""
            echo "  Zentro v2 · dev shell (Nix)"
            echo "  ───────────────────────────"
            echo "  bun $(bun --version)  ·  $(postgres --version)"
            echo ""
            echo "  nix run            → postgres + zero-cache + app (process-compose)"
            echo "  pg-start / pg-stop → Postgres nativo en background"
            echo "  pg-psql            → abre psql en la base zentro"
            echo "  db-reset           → borra el data dir de Postgres"
            echo "  env-reset          → borra Postgres + réplica de Zero (reset total)"
            echo ""
          '';
        };
      }
    );
}
