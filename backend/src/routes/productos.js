const express = require("express");
const router = express.Router();
const pool = require("../db");
const { cloudinary, upload } = require("../cloudinary");

// GET /api/productos — listar todos
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM productos ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

// GET /api/productos/:id — obtener uno
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM productos WHERE id = $1",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener producto" });
  }
});

// POST /api/productos — crear con imagen opcional
router.post("/", upload.single("imagen"), async (req, res) => {
  const { nombre, categoria, precio, descripcion, stock } = req.body;

  if (!nombre || !categoria || !precio || !descripcion || stock === undefined) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  const imagen_url = req.file ? req.file.path : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO productos (nombre, categoria, precio, descripcion, stock, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, categoria, precio, descripcion, stock, imagen_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear producto" });
  }
});

// PUT /api/productos/:id — editar con imagen opcional
router.put("/:id", upload.single("imagen"), async (req, res) => {
  const { nombre, categoria, precio, descripcion, stock } = req.body;

  try {
    // Si viene imagen nueva, eliminar la anterior de Cloudinary
    if (req.file) {
      const { rows: actual } = await pool.query(
        "SELECT imagen_url FROM productos WHERE id = $1",
        [req.params.id]
      );
      if (actual[0]?.imagen_url) {
        // Extraer public_id de la URL de Cloudinary y eliminar
        const url = actual[0].imagen_url;
        const publicId = url
          .split("/upload/")[1]        // toma todo lo que viene después de /upload/
          .replace(/^v\d+\//, "")     // elimina la versión (v1234567890/)
          .replace(/\.[^/.]+$/, "");  // elimina la extensión (.jpg, .png, etc.)
        await cloudinary.uploader.destroy(publicId).catch(() => {});
      }
    }

    const imagen_url = req.file ? req.file.path : undefined;

    const { rows } = await pool.query(
      `UPDATE productos
       SET nombre=$1, categoria=$2, precio=$3, descripcion=$4, stock=$5
       ${imagen_url !== undefined ? ", imagen_url=$6" : ""}
       WHERE id=${imagen_url !== undefined ? "$7" : "$6"} RETURNING *`,
      imagen_url !== undefined
        ? [nombre, categoria, precio, descripcion, stock, imagen_url, req.params.id]
        : [nombre, categoria, precio, descripcion, stock, req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

// DELETE /api/productos/:id — eliminar producto e imagen
router.delete("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT imagen_url FROM productos WHERE id = $1",
      [req.params.id]
    );

    if (rows[0]?.imagen_url) {
      const url = rows[0].imagen_url;
      const publicId = url
        .split("/upload/")[1]
        .replace(/^v\d+\//, "")
        .replace(/\.[^/.]+$/, "");
      await cloudinary.uploader.destroy(publicId);
    }

    const { rowCount } = await pool.query(
      "DELETE FROM productos WHERE id = $1",
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;