#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE collm_users;
	CREATE DATABASE collm_core;
	GRANT ALL PRIVILEGES ON DATABASE collm_users TO postgres;
	GRANT ALL PRIVILEGES ON DATABASE collm_core TO postgres;
EOSQL
