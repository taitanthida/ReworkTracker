namespace ReworkApi.Models
{
    // คลาสลูกสำหรับเก็บรายการ Defect
    public class DefectDetailDto
    {
        public string Code { get; set; } = string.Empty;
        public int Qty { get; set; }
    }

    // DTO สำหรับรับข้อมูลตอน POST /labels (สร้างป้ายใหม่)
    public class CreateLabelDto
    {
        public string LabelId { get; set; } = string.Empty;
        public string OrderId { get; set; } = string.Empty;
        public string? MaterialId { get; set; }
        public string? Description { get; set; }
        public string? LinePost { get; set; }
        public int? Total { get; set; }
        public int Round { get; set; }
        public string? Status { get; set; }
        public int? InputQty { get; set; }
        public List<DefectDetailDto>? DefectCodes { get; set; }
        public string? Remark { get; set; }
        public int? QcId { get; set; }
        public string? QcName { get; set; }
        public int? IssuedById { get; set; }
        public string? IssuedBy { get; set; }
        public string? IssuedDate { get; set; } // รับมาเป็น DD/MM/YY สตริงตามเดิม
    }

    // DTO สำหรับรับข้อมูลตอน PATCH /labels/:id (อัปเดตสเตตัส/ปิดงาน)
    public class UpdateLabelDto
    {
        public string? Status { get; set; }
        public string? ReceivedDate { get; set; }
        public string? ReturnedDate { get; set; }
        public string? ClosedDate { get; set; }
        public int? ResultGoodQty { get; set; }
        public int? ResultBadQty { get; set; }
        public bool? IsScrapped { get; set; }
        public string? Remark { get; set; }
        public int? QcId { get; set; }
        public string? QcName { get; set; }
        public int? IssuedById { get; set; }
        public string? IssuedBy { get; set; }
        public int? ReceivedById { get; set; }
        public string? ReceivedBy { get; set; }
        public int? ReturnedById { get; set; }
        public string? ReturnedBy { get; set; }
        public int? ClosedById { get; set; }
        public string? ClosedBy { get; set; }
    }
}