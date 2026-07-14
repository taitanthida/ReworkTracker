var builder = WebApplication.CreateBuilder(args);

// เปิดใช้งานระบบ Controller
builder.Services.AddControllers();

// ตั้งค่า CORS เปิดทางให้ Next.js ยิงเข้ามาได้ทุกพอร์ต
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// เรียกใช้งาน CORS
app.UseCors("AllowAll");

app.UseAuthorization();

// สั่งให้ระบบผูก Route เข้าหา ReworkController.cs อัตโนมัติ
app.MapControllers();

app.Run();