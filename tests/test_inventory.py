from openpyxl import Workbook
from fastapi.testclient import TestClient

from app import main
from app.main import cell_code, find_inventory_column, normalize_code, normalize_header


def test_header_normalization_and_detection():
    headers = ["Descripción", "N.º de Inventario", "Área"]
    assert normalize_header(headers[1]) == "nodeinventario"
    assert find_inventory_column(headers, "N.º de Inventario") == 2


def test_auto_detect_inventory_header():
    assert find_inventory_column(["Equipo", "Nro Inventario"], None) == 2


def test_numeric_code_removes_excel_decimal():
    assert normalize_code("12345.0") == "12345"


def test_cell_code_preserves_zero_number_format():
    workbook = Workbook()
    cell = workbook.active["A1"]
    cell.value = 123
    cell.number_format = "000000"
    assert cell_code(cell) == "000123"


def test_demo_scan_stats_and_export(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "inventario.db")
    monkeypatch.setattr(main, "SOURCE_PATH", tmp_path / "inventario_origen.xlsx")
    monkeypatch.setattr(main, "EXPORT_PATH", tmp_path / "inventario_resultado.xlsx")

    with TestClient(main.app) as client:
        assert client.post("/api/demo").status_code == 200

        found = client.post(
            "/api/scan", json={"code": "000101", "scanner_name": "Prueba"}
        ).json()
        repeated = client.post(
            "/api/scan", json={"code": "000101", "scanner_name": "Prueba"}
        ).json()
        unknown = client.post(
            "/api/scan", json={"code": "999999", "scanner_name": "Prueba"}
        ).json()

        assert found["status"] == "found"
        assert repeated["status"] == "repeated"
        assert unknown["status"] == "unknown"

        stats = client.get("/api/stats").json()
        assert stats == {
            "loaded": True,
            "filename": "inventario_demo.xlsx",
            "total": 3,
            "found": 1,
            "pending": 2,
            "unknown": 1,
            "duplicates": 1,
            "percent": 33.3,
        }

        response = client.get("/api/export")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
