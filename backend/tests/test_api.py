"""
API tests (standard-library unittest, no extra dependencies).
Run from backend/:   python -m unittest discover -s tests -v
Requires trained models in saved_models/ (python -m training.train).
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import app  # noqa: E402

VALID = {"State": "Punjab", "District": "Ludhiana", "Crop": "Wheat", "Season": "Rabi",
         "Crop_Year": 2012, "Area": 250000, "Annual_Rainfall": 620}


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = app.test_client()

    def test_health(self):
        r = self.c.get("/api/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["status"], "ok")
        self.assertEqual(len(r.get_json()["models_loaded"]), 5)

    def test_metadata(self):
        d = self.c.get("/api/metadata").get_json()
        for k in ("states", "districts", "crops", "seasons", "features", "unsupported_features"):
            self.assertIn(k, d)
        self.assertIn("Ludhiana", d["districts"]["Punjab"])
        self.assertEqual([f["name"] for f in d["features"]],
                         ["State", "District", "Crop", "Season", "Crop_Year", "Area", "Annual_Rainfall"])

    def test_predict_valid(self):
        r = self.c.post("/api/predict", json=VALID)
        self.assertEqual(r.status_code, 200)
        d = r.get_json()
        self.assertEqual(len(d["predictions"]), 8)
        self.assertTrue(0 < d["predicted_yield_tha"] < 20)
        w = d["bma"]["weights"]
        self.assertAlmostEqual(sum(w.values()), 1.0, places=6)
        # BMA prediction must equal sum(weight * base prediction)
        base = {p["key"]: p["yield_tha"] for p in d["predictions"]}
        self.assertAlmostEqual(base["bma"], sum(w[k] * base[k] for k in w), places=6)

    def test_predict_deterministic(self):
        a = self.c.post("/api/predict", json=VALID).get_json()["predicted_yield_tha"]
        b = self.c.post("/api/predict", json=VALID).get_json()["predicted_yield_tha"]
        self.assertEqual(a, b)

    def test_predict_invalid_fields(self):
        bad = {**VALID, "District": "Chennai", "Crop_Year": 2030, "Area": -1}
        bad.pop("Annual_Rainfall")
        r = self.c.post("/api/predict", json=bad)
        self.assertEqual(r.status_code, 422)
        det = r.get_json()["details"]
        for k in ("District", "Crop_Year", "Area", "Annual_Rainfall"):
            self.assertIn(k, det)

    def test_predict_wrong_season(self):
        r = self.c.post("/api/predict", json={**VALID, "Crop": "Wheat", "Season": "Autumn"})
        self.assertIn(r.status_code, (200, 422))
        if r.status_code == 422:
            self.assertIn("Season", r.get_json()["details"])

    def test_predict_bad_json(self):
        r = self.c.post("/api/predict", data="not json", content_type="application/json")
        self.assertEqual(r.status_code, 400)

    def test_model_metrics(self):
        d = self.c.get("/api/model-metrics").get_json()
        self.assertEqual(len(d["metrics"]), 8)
        for m in d["metrics"]:
            self.assertAlmostEqual(m["rmse"] ** 2, m["mse"], places=6)

    def test_analytics_filters(self):
        d = self.c.get("/api/analytics?state=Punjab&crop=Rice").get_json()
        self.assertEqual(d["kpis"]["states"], 1)
        self.assertIsNotNone(d["kpis"]["avg_yield_tha"])
        self.assertEqual(self.c.get("/api/analytics?crop=Nope").status_code, 400)
        self.assertEqual(self.c.get("/api/analytics?year=abc").status_code, 400)

    def test_feature_importance_and_trends(self):
        self.assertEqual(self.c.get("/api/feature-importance").status_code, 200)
        d = self.c.get("/api/historical-trends?crop=Wheat&state=Punjab").get_json()
        self.assertGreater(len(d["series"]), 5)

    def test_404(self):
        self.assertEqual(self.c.get("/api/does-not-exist").status_code, 404)


if __name__ == "__main__":
    unittest.main()
