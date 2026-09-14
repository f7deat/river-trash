using Microsoft.AspNetCore.Mvc;
using RiverTrash.Models;
using RiverTrash.Services;

namespace RiverTrash.Controllers;

[Route("[controller]")]
public class DetectionController : Controller
{
    private readonly IYoloInferenceService _yoloService;

    public DetectionController(IYoloInferenceService yoloService)
    {
        _yoloService = yoloService;
    }

    /// <summary>
    /// API nhận diện rác từ ảnh chụp hoặc frame camera gửi lên
    /// </summary>
    [HttpPost("detect-image")]
    public IActionResult DetectImage([FromForm] FileArgs args)
    {
        if (args.File == null || args.File.Length == 0)
        {
            return BadRequest(new { Message = "File ảnh không hợp lệ." });
        }

        try
        {
            var result = _yoloService.DetectGarbageFromImage(args.File);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Message = "Lỗi xử lý AI: " + ex.Message });
        }
    }
}
