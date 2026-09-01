from io import BytesIO

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
    assert find_inventory_column(["Cód. bien", "Bien", "Tipo bien"], None) == 1


def test_numeric_code_removes_excel_decimal():
    assert normalize_code("12345.0") == "12345"


def test_asset_code_keeps_zeros_and_normalizes_case_and_dash():
    assert normalize_code(" a030008 – 000000000248 ") == "A030008-000000000248"


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


def test_import_mobile_xlsx_and_compare(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "inventario.db")
    monkeypatch.setattr(main, "SOURCE_PATH", tmp_path / "inventario_origen.xlsx")
    monkeypatch.setattr(main, "EXPORT_PATH", tmp_path / "inventario_resultado.xlsx")

    mobile_workbook = Workbook()
    mobile_sheet = mobile_workbook.active
    mobile_sheet.append(["Numero Inventario", "Fecha y hora", "Operador", "Sector"])
    mobile_sheet.append(["000101", "2026-09-01T10:00:00-03:00", "Jony", "Sistemas"])
    mobile_sheet.append(["000101", "2026-09-01T10:01:00-03:00", "Jony", "Sistemas"])
    mobile_sheet.append(["999999", "2026-09-01T10:02:00-03:00", "Jony", "Sistemas"])
    buffer = BytesIO()
    mobile_workbook.save(buffer)

    with TestClient(main.app) as client:
        assert client.post("/api/demo").status_code == 200
        response = client.post(
            "/api/scans/import",
            files={
                "files": (
                    "escaneo_sistemas.xlsx",
                    buffer.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert response.status_code == 200
        assert response.json()["imported_events"] == 3
        assert response.json()["found_events"] == 1
        assert response.json()["repeated_events"] == 1
        assert response.json()["unknown_events"] == 1

        stats = client.get("/api/stats").json()
        assert stats["found"] == 1
        assert stats["pending"] == 2
        assert stats["duplicates"] == 1
        assert stats["unknown"] == 1


def test_mobile_pwa_files_are_served(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "inventario.db")
    monkeypatch.setattr(main, "SOURCE_PATH", tmp_path / "inventario_origen.xlsx")
    monkeypatch.setattr(main, "EXPORT_PATH", tmp_path / "inventario_resultado.xlsx")
    with TestClient(main.app) as client:
        page = client.get("/mobile/")
        manifest = client.get("/mobile/manifest.webmanifest")
        service_worker = client.get("/mobile/sw.js")
        assert page.status_code == 200
        assert "Escáner de inventario" in page.text
        assert manifest.status_code == 200
        assert service_worker.status_code == 200
