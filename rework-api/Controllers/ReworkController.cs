using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Mvc;
using MySqlConnector;
using Dapper;
using System.Data;
using System.Globalization;
using ReworkApi.Models;

namespace ReworkApi.Controllers
{
    [ApiController]
    [Route("api")]
    public class ReworkController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly string _sqlServerConnectionString;

        public ReworkController(IConfiguration configuration)
        {
            // ดึง Connection String จาก appsettings.json
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                                ?? throw new ArgumentNullException(nameof(configuration));
            // ดึงสาย SQL Server มารอไว้ที่ตัวแปรใหม่ตรงนี้
            _sqlServerConnectionString = configuration.GetConnectionString("SqlServerConnection") ?? "";
        }

        private IDbConnection CreateConnection() => new MySqlConnection(_connectionString);

        // ── Helper Functions ────────────────────────────────────────────────────────

        // แปลงฟอร์แมต DD/MM/YY → DATETIME (แทนฟังก์ชัน parseDate ใน Node.js)
        private DateTime? ParseDate(string? dateStr)
        {
            if (string.IsNullOrEmpty(dateStr)) return null;
            if (DateTime.TryParseExact(dateStr, "d/M/yy", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime parsedDate))
            {
                return parsedDate;
            }
            if (DateTime.TryParseExact(dateStr, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime parsedIsoDate))
            {
                return parsedIsoDate;
            }
            return null;
        }

        // แปลงสตริง "CODE:QTY,CODE:QTY" -> List 
        private List<DefectDetailDto> ParseDefectDetails(string? defectDetailsStr)
        {
            var list = new List<DefectDetailDto>();
            if (string.IsNullOrEmpty(defectDetailsStr)) return list;

            var pairs = defectDetailsStr.Split(',');
            foreach (var pair in pairs)
            {
                var parts = pair.Split(':');
                if (parts.Length == 2 && int.TryParse(parts[1], out int qty))
                {
                    list.Add(new DefectDetailDto { Code = parts[0], Qty = qty });
                }
            }
            return list;
        }

        // ฟังก์ชันช่วยจัดรูปแบบ Dynamic Row Object (ดึง list, defect_codes / defect_details)
        private dynamic FormatLabelRow(dynamic row)
        {
            if (row == null) return null;
            
            string? codesStr = row.defect_codes;
            string? detailsStr = row.defect_details;

            row.defect_codes = !string.IsNullOrEmpty(codesStr) ? codesStr.Split(',').ToList() : new List<string>();
            row.defect_details = ParseDefectDetails(detailsStr);
            return row;
        }

        // ── Routes ───────────────────────────────────────────────────────────────────

        [HttpGet("")]
        public IActionResult GetRoot() => Ok(new { message = "Rework API is running (C# .NET)" });

        // GET /api/labels
        [HttpGet("labels")]
        public async Task<IActionResult> GetAllLabels()
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT rl.*,
                       po.material_id, po.description, po.line_post, po.prog_plan, po.qc_after_p, po.total_qty AS total, po.pack_wk,
                       GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes,
                       GROUP_CONCAT(CONCAT(ld.defect_code, ':', ld.defect_qty) ORDER BY ld.defect_code SEPARATOR ',') AS defect_details
                FROM rework_labels rl
                LEFT JOIN production_orders po ON po.order_id = rl.order_id
                LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
                GROUP BY rl.label_id
                ORDER BY rl.created_at DESC";

            try
            {
                var rows = (await conn.QueryAsync(sql)).ToList();
                var result = rows.Select(FormatLabelRow).ToList();
                return Ok(result);
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // GET /api/labels/next-id?date=YYYY-MM-DD
        [HttpGet("labels/next-id")]
        public async Task<IActionResult> GetNextId([FromQuery] string date)
        {
            if (string.IsNullOrEmpty(date)) return BadRequest(new { error = "date query param required (YYYY-MM-DD)" });

            using var conn = CreateConnection();
            string sql = "SELECT COUNT(*) FROM rework_labels WHERE DATE(issued_at) = @Date";

            try
            {
                int count = await conn.ExecuteScalarAsync<int>(sql, new { Date = date });
                string seq = (count + 1).ToString().PadLeft(2, '0');
                string compact = date.Replace("-", "");
                return Ok(new { labelId = $"RW-{compact}-{seq}" });
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // GET /api/labels/queue
        [HttpGet("labels/queue")]
        public async Task<IActionResult> GetQueue()
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT rl.*,
                       po.material_id, po.description, po.line_post, po.prog_plan, po.qc_after_p, po.total_qty AS total, po.pack_wk,
                       GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes,
                       GROUP_CONCAT(CONCAT(ld.defect_code, ':', ld.defect_qty) ORDER BY ld.defect_code SEPARATOR ',') AS defect_details
                FROM rework_labels rl
                LEFT JOIN production_orders po ON po.order_id = rl.order_id
                LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
                WHERE rl.status IN ('ISSUED','IN_PROGRESS','RETURNED')
                GROUP BY rl.label_id
                ORDER BY rl.created_at DESC";

            try
            {
                var rows = (await conn.QueryAsync(sql)).ToList();
                var result = rows.Select(FormatLabelRow).ToList();
                return Ok(result);
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // GET /api/labels/:id
        [HttpGet("labels/{id}")]
        public async Task<IActionResult> GetLabelById(string id)
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT rl.*,
                       po.material_id, po.description, po.line_post, po.prog_plan, po.qc_after_p, po.total_qty AS total, po.pack_wk,
                       GROUP_CONCAT(ld.defect_code ORDER BY ld.defect_code SEPARATOR ',') AS defect_codes,
                       GROUP_CONCAT(CONCAT(ld.defect_code, ':', ld.defect_qty) ORDER BY ld.defect_code SEPARATOR ',') AS defect_details
                FROM rework_labels rl
                LEFT JOIN production_orders po ON po.order_id = rl.order_id
                LEFT JOIN label_defects ld ON ld.label_id = rl.label_id
                WHERE rl.label_id = @Id
                GROUP BY rl.label_id";

            try
            {
                var row = await conn.QueryFirstOrDefaultAsync(sql, new { Id = id });
                if (row == null) return NotFound(new { error = "Label not found" });

                return Ok(FormatLabelRow(row));
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // POST /api/labels (ระบบสร้างฉลากแบบใช้ Transaction ครอบคลุม 3 ตาราง)
        [HttpPost("labels")]
        public async Task<IActionResult> CreateLabel([FromBody] CreateLabelDto body)
        {
            if (body == null || string.IsNullOrEmpty(body.LabelId) || string.IsNullOrEmpty(body.OrderId) || body.Round == 0)
            {
                return BadRequest(new { error = "labelId, orderId, round are required" });
            }

            using var conn = CreateConnection();
            conn.Open();
            using var transaction = conn.BeginTransaction();

            try
            {
                // 1. Upsert ข้อมูลลงตาราง production_orders
                string upsertOrderSql = @"
                    INSERT INTO production_orders (order_id, material_id, description, line_post, total_qty, source)
                    VALUES (@OrderId, @MaterialId, @Description, @LinePost, @Total, 'manual')
                    ON DUPLICATE KEY UPDATE
                        material_id = COALESCE(VALUES(material_id), material_id),
                        description = COALESCE(VALUES(description), description),
                        line_post   = COALESCE(VALUES(line_post),   line_post),
                        total_qty   = COALESCE(VALUES(total_qty),   total_qty)";

                await conn.ExecuteAsync(upsertOrderSql, new {
                    body.OrderId, body.MaterialId, body.Description, body.LinePost, body.Total
                }, transaction);

                // 2. จัดสรรเลข round แบบ atomic ในทรานแซกชัน — กันชน uq_order_round
                // เมื่อ UI ค้าง/ส่งซ้ำ หรือมี round ใหม่กว่าที่ client เห็น
                // (client ส่ง body.Round มาเพื่อ hint แต่ server เป็นผู้ตัดสินเลขจริง)
                string nextRoundSql = @"
                    SELECT COALESCE(MAX(round_no), 0) + 1
                    FROM rework_labels
                    WHERE order_id = @OrderId
                    FOR UPDATE";
                int nextRound = await conn.ExecuteScalarAsync<int>(nextRoundSql, new { body.OrderId }, transaction);

                // 3. Insert ข้อมูลลงตาราง rework_labels
                string insertLabelSql = @"
                    INSERT INTO rework_labels (
                        label_id, order_id, round_no, status, input_qty, remark, qc_id, qc_name, issued_by_id, issued_by, issued_at
                    ) VALUES (@LabelId, @OrderId, @Round, @Status, @InputQty, @Remark, @QcId, @QcName, @IssuedById, @IssuedBy, @IssuedAt)";

                await conn.ExecuteAsync(insertLabelSql, new {
                    body.LabelId, body.OrderId, Round = nextRound,
                    Status = body.Status ?? "ISSUED",
                    InputQty = body.InputQty ?? 0,
                    body.Remark, body.QcId, body.QcName, body.IssuedById, body.IssuedBy,
                    IssuedAt = ParseDate(body.IssuedDate)
                }, transaction);

                // 4. Insert / Update ตารางย่อย label_defects
                if (body.DefectCodes != null && body.DefectCodes.Count > 0)
                {
                    string insertDefectSql = @"
                        INSERT INTO label_defects (label_id, defect_code, defect_qty)
                        VALUES (@LabelId, @Code, @Qty)
                        ON DUPLICATE KEY UPDATE defect_qty = VALUES(defect_qty)";

                    foreach (var defect in body.DefectCodes)
                    {
                        await conn.ExecuteAsync(insertDefectSql, new {
                            body.LabelId, defect.Code, Qty = defect.Qty != 0 ? defect.Qty : 1
                        }, transaction);
                    }
                }

                transaction.Commit();
                return Ok(new { success = true, labelId = body.LabelId, round = nextRound });
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // PATCH /api/labels/:id (Dynamic Update)
        [HttpPatch("labels/{id}")]
        public async Task<IActionResult> UpdateLabel(string id, [FromBody] UpdateLabelDto body)
        {
            using var conn = CreateConnection();
            
            // แมปคีย์หน้าบ้าน เข้ากับ คอลัมน์ฐานข้อมูลตามแบบฉบับดั้งเดิมของพี่
            var allowed = new Dictionary<string, string> {
                { "Status", "status" },
                { "ReceivedDate", "received_at" },
                { "ReturnedDate", "returned_at" },
                { "ClosedDate", "closed_at" },
                { "ResultGoodQty", "result_good_qty" },
                { "ResultBadQty", "result_bad_qty" },
                { "IsScrapped", "is_scrapped" },
                { "Remark", "remark" },
                { "QcId", "qc_id" },
                { "QcName", "qc_name" },
                { "IssuedById", "issued_by_id" },
                { "IssuedBy", "issued_by" },
                { "ReceivedById", "received_by_id" },
                { "ReceivedBy", "received_by" },
                { "ReturnedById", "returned_by_id" },
                { "ReturnedBy", "returned_by" },
                { "ClosedById", "closed_by_id" },
                { "ClosedBy", "closed_by" }
            };

            var fields = new List<string>();
            var parameters = new DynamicParameters();

            foreach (var kp in allowed)
            {
                var property = body.GetType().GetProperty(kp.Key);
                if (property == null) continue;
                var val = property.GetValue(body);
                if (val == null) continue; // ข้ามฟิลด์ที่ส่งมาเป็น undefined / null

                fields.Add($"{kp.Value} = @{kp.Key}");

                if (kp.Key == "IsScrapped") parameters.Add(kp.Key, (bool)val ? 1 : 0);
                else if (kp.Key.EndsWith("Date")) parameters.Add(kp.Key, ParseDate(val.ToString()));
                else parameters.Add(kp.Key, val);
            }

            if (fields.Count == 0) return BadRequest(new { error = "No valid fields to update" });

            parameters.Add("Id", id);
            string sql = $"UPDATE rework_labels SET {string.Join(", ", fields)} WHERE label_id = @Id";

            try
            {
                int affectedRows = await conn.ExecuteAsync(sql, parameters);
                if (affectedRows == 0) return NotFound(new { error = "Label not found" });
                return Ok(new { success = true });
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // GET /api/orders/:id
        [HttpGet("orders/{id}")]
        public async Task<IActionResult> GetOrderInfo(string id)
        {
            using var conn = CreateConnection();
            string orderSql = "SELECT * FROM production_orders WHERE order_id = @Id";
            string labelSql = "SELECT * FROM rework_labels WHERE order_id = @Id ORDER BY round_no DESC LIMIT 1";

            try
            {
                var order = await conn.QueryFirstOrDefaultAsync(orderSql, new { Id = id });
                if (order == null) return NotFound(new { error = "Order not found" });

                var latestLabel = await conn.QueryFirstOrDefaultAsync(labelSql, new { Id = id });

                return Ok(new { order, latestLabel });
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // GET /api/defect-codes
        [HttpGet("defect-codes")]
        public async Task<IActionResult> GetDefectCodes()
        {
            using var conn = CreateConnection();
            string sql = "SELECT defect_code, description_th FROM defect_codes WHERE is_active = 1 ORDER BY defect_code ASC";
            try
            {
                var rows = await conn.QueryAsync(sql);
                return Ok(rows);
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // GET /api/users/qc
        [HttpGet("users/qc")]
        public async Task<IActionResult> GetQcUsers()
        {
            using var conn = new MySqlConnection(_connectionString);
            try
            {
                await conn.OpenAsync();
                string sql = "SELECT id, username, full_name, role FROM users WHERE role = 'qc' AND is_active = 1";
                var users = await conn.QueryAsync(sql);
                return Ok(users);
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // GET /api/users/rework
        [HttpGet("users/rework")]
        public async Task<IActionResult> GetReworkUsers()
        {
            using var conn = new MySqlConnection(_connectionString);
            try
            {
                await conn.OpenAsync();
                string sql = "SELECT id, username, full_name, role FROM users WHERE role = 'rw_station' AND is_active = 1";
                var users = await conn.QueryAsync(sql);
                return Ok(users);
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        // GET /api/users (ทุก role ที่ active — ใช้ resolve ชื่อจาก *_by_id)
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            using var conn = new MySqlConnection(_connectionString);
            try
            {
                await conn.OpenAsync();
                string sql = "SELECT id, username, full_name, role FROM users WHERE is_active = 1";
                var users = await conn.QueryAsync(sql);
                return Ok(users);
            }
            catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
        }

        [HttpGet("orders")]
        public async Task<IActionResult> GetProductionOrders([FromQuery] string? search)
        {
            // สร้างสายตรงจาก MySqlConnection เพื่อให้รองรับ OpenAsync()
            using var conn = new MySqlConnection(_connectionString);
            await conn.OpenAsync();

            var sql = "SELECT * FROM production_orders WHERE 1=1";
            var parameters = new DynamicParameters();

            if (!string.IsNullOrEmpty(search))
            {
                sql += " AND (order_id LIKE @Search OR material_id LIKE @Search)";
                parameters.Add("Search", $"%{search}%");
            }
            else
            {
                // โชว์แค่ 50 แถวแรก
                sql += " ORDER BY synced_at DESC LIMIT 100";
            }

            var orders = await conn.QueryAsync(sql, parameters);
            return Ok(orders);
        }

        [HttpGet("sync/orders")]
        public async Task<IActionResult> SyncProductionOrders()
        {
            var sqlServerConnString = _sqlServerConnectionString;
            var mySqlConnString = _connectionString;

            Console.WriteLine("Starting Sync from SQL Server (WIP_DATA) to MySQL...");

            try
            {
                // ดึงข้อมูลจริงจาก SQL Server
                using var sqlServerConn = new SqlConnection(sqlServerConnString);
                await sqlServerConn.OpenAsync();
                
                // ใช้ AS เพื่อเปลี่ยนชื่อคอลัมน์ให้ตรงกับตารางปลายทาง MySQL
                var sqlServerQuery = @"
                    SELECT 
                        [Order]                   AS order_id, 
                        [Material]                AS material_id, 
                        [MaterialDescription]     AS description,
                        [OpenQuantity]            AS total_qty, 
                        [PostPlatingLinePlanning] AS line_post, 
                        [ProgressPlanning]        AS prog_plan,
                        [ProgressPlanning]        AS qc_after_p, 
                        [TargetPackingWK]         AS pack_wk
                    FROM [SMTKPIDASHBOARD].[dbo].[WIP_DATA]
                    WHERE [OrderType] = 'M001'
                    AND (
                        [ProgressPlanning] IN ('FINS6499', 'FINS6697', 'FINS6698', 'FINS6699')
                        
                    )";

                var rows = (await sqlServerConn.QueryAsync<dynamic>(sqlServerQuery)).ToList();
                Console.WriteLine($"Extracted {rows.Count} rows from SQL Server");

                // 2. เชื่อมต่อ MySQL เพื่อเตรียมทำ ON DUPLICATE KEY UPDATE
                using var mySqlConn = new MySqlConnection(mySqlConnString);
                await mySqlConn.OpenAsync();

                // 3. วนลูปสาดข้อมูลเข้า MySQL
                foreach (var row in rows)
                {
                    var mySqlQuery = @"
                        INSERT INTO production_orders (order_id, material_id, description, total_qty, line_post, prog_plan, qc_after_p, pack_wk, source, synced_at)
                        VALUES (@order_id, @material_id, @description, @total_qty, @line_post, @prog_plan, @qc_after_p, @pack_wk, 'erp', NOW())
                        ON DUPLICATE KEY UPDATE 
                            material_id = VALUES(material_id),
                            description = VALUES(description),
                            total_qty = VALUES(total_qty),
                            line_post = VALUES(line_post),
                            prog_plan = VALUES(prog_plan),
                            qc_after_p = VALUES(qc_after_p),
                            pack_wk   = VALUES(pack_wk),
                            synced_at = NOW();";

                    await mySqlConn.ExecuteAsync(mySqlQuery, new {
                        order_id    = row.order_id?.ToString(),
                        material_id = row.material_id?.ToString(),
                        description = row.description?.ToString(),
                        total_qty   = row.total_qty,
                        line_post   = row.line_post?.ToString(),
                        prog_plan   = row.prog_plan?.ToString(),
                        qc_after_p  = row.qc_after_p?.ToString(),
                        pack_wk     = row.pack_wk?.ToString()
                    });
                }

                Console.WriteLine("Saved to MySQL Successfully!");
                return Ok(new { message = "Sync WIP_DATA from SQL Server to MySQL complete!", totalRows = rows.Count });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"An Error occurred during Sync: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}