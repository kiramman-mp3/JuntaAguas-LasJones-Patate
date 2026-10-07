const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const codigos = require("../src/utils/loteCodigo");

// Aísla la API de MySQL para reproducir conflictos y carreras sin alterar datos.
function controlador(query) {
  const contexto = {
    module: { exports: {} },
    require: (nombre) => {
      if (nombre === "../config/db") return { query };
      if (nombre === "../services/auditService")
        return { registrarAuditoria: async () => {} };
      if (nombre === "../utils/loteCodigo") return codigos;
      throw new Error(`Dependencia inesperada: ${nombre}`);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../src/controllers/loteController.js"),
      "utf8",
    ),
    contexto,
  );
  return contexto.module.exports;
}

function respuesta() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const falloInesperado = (error) => {
  throw error;
};

test("conserva el prefijo fijo del sector aunque cambie el catastro y normaliza letras", () => {
  assert.equal(
    codigos.prefijoSector("La Jones Alto", ["OLD-001", "OLD-002", "OLD-003"]),
    "LJA",
  );
  assert.equal(codigos.prefijoSector("Árbol del río"), "ADR");
  assert.equal(codigos.prefijoSector("Sector Las Jones Alto"), "LJA");
  assert.equal(codigos.prefijoSector("La Jones Baja"), "LJB");
  assert.equal(codigos.prefijoSector("Sector Las Jones Centro"), "LJC");
  assert.equal(codigos.prefijoSector("El Tambo"), "ELT");
  assert.equal(codigos.prefijoSector("Los Cuyes"), "LCU");
  assert.equal(codigos.prefijoSector("Sector Árbol del río"), "ADR");
  assert.equal(codigos.normalizarCodigo(" lja-001 "), "LJA-001");
  assert.equal(codigos.FORMATO_CODIGO_LOTE.test("LJA-1000"), true);
  assert.equal(codigos.FORMATO_CODIGO_LOTE.test("LJA-1"), false);
});

test("sugiere el consecutivo global incluyendo códigos ocupados fuera del sector", async () => {
  const consultas = [];
  const api = controlador(async (sql, params) => {
    consultas.push(sql);
    if (sql.includes("FROM sectores")) return [[{ nombre: "La Jones Alto" }]];
    if (sql.includes("sector_id = ?")) return [[{ codigo: "LJA-001" }]];
    assert.equal(params[0], "LJA-%");
    return [
      [{ codigo: "LJA-001" }, { codigo: "LJA-004" }, { codigo: "LJA-010" }],
    ];
  });
  const res = respuesta();
  await api.sugerirCodigo({ query: { sector_id: "1" } }, res, falloInesperado);
  assert.equal(res.body.data.codigo, "LJA-011");
  assert.ok(
    consultas
      .filter((sql) => sql.includes("FROM lotes"))
      .every((sql) => !sql.includes("activo")),
  );
});

test("rechaza un sector inválido sin consultar la base de datos", async () => {
  const api = controlador(() => {
    throw new Error("No debe consultar");
  });
  const res = respuesta();
  await api.sugerirCodigo(
    { query: { sector_id: "abc" } },
    res,
    falloInesperado,
  );
  assert.equal(res.statusCode, 400);
});

test("no sugiere códigos para sectores inexistentes o inactivos", async () => {
  const api = controlador(async () => [[]]);
  const res = respuesta();
  await api.sugerirCodigo({ query: { sector_id: "1" } }, res, falloInesperado);
  assert.equal(res.statusCode, 404);
});

test("rechaza formato inválido y no ejecuta INSERT", async () => {
  const api = controlador(() => {
    throw new Error("No debe consultar");
  });
  const res = respuesta();
  await api.createLote(
    { body: { sector_id: 1, codigo: "cualquier texto" } },
    res,
    falloInesperado,
  );
  assert.equal(res.statusCode, 400);
});

test("rechaza un código existente con 409", async () => {
  const api = controlador(async (sql, params) => {
    assert.ok(sql.startsWith("SELECT"));
    assert.equal(params[0], "LJA-001");
    return [[{ id: 7 }]];
  });
  const res = respuesta();
  await api.createLote(
    { body: { sector_id: 1, codigo: " lja-001 " } },
    res,
    falloInesperado,
  );
  assert.equal(res.statusCode, 409);
});

test("devuelve 409 si otro registro ocupa el código después de comprobarlo", async () => {
  const api = controlador(async (sql) => {
    if (sql.startsWith("SELECT")) return [[]];
    const error = new Error("Duplicate entry");
    error.code = "ER_DUP_ENTRY";
    throw error;
  });
  const res = respuesta();
  await api.createLote(
    { body: { sector_id: 1, codigo: "LJA-001" } },
    res,
    falloInesperado,
  );
  assert.equal(res.statusCode, 409);
});

test("crea el lote con código normalizado y devuelve su identificador", async () => {
  const api = controlador(async (sql, params) => {
    if (sql.startsWith("SELECT")) return [[]];
    assert.equal(params[1], "LJA-001");
    return [{ insertId: 8 }];
  });
  const res = respuesta();
  await api.createLote(
    {
      body: { sector_id: 1, codigo: " lja-001 " },
      user: { cuentaId: 1 },
      ip: "127.0.0.1",
    },
    res,
    falloInesperado,
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.loteId, 8);
});
