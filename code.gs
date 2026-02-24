// =================================================================
// GOOGLE APPS SCRIPT - API CHO CLASSROOM MANAGER
// Chức năng: Upload ảnh lên Drive, Lưu Sheets, Chấm bài AI
// =================================================================

// !!! THAY ĐỔI CÁC GIÁ TRỊ NÀY !!!
const SHEET_ID = "YOUR_GOOGLE_SHEET_ID"; // ID của Google Sheet

// Cấu hình
const CONFIG = {
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  DRIVE_FOLDERS: {
    ASSIGNMENTS: 'Classroom_Assignments',
    SOLUTIONS: 'Classroom_Solutions',
    SUBMISSIONS: 'Classroom_Submissions'
  },
  MAX_IMAGE_SIZE: 10 * 1024 * 1024 // 10MB
};

// Global
let ss, SHEETS;

// =================================================================
// WEB APP ENTRY POINTS
// =================================================================

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Classroom Manager API v1.0'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    
    switch (action) {
      // Assignment APIs
      case 'createAssignment':
        result = createAssignment(data);
        break;
      case 'getAssignments':
        result = getAssignments(data.classId);
        break;
      case 'deleteAssignment':
        result = deleteAssignment(data.assignmentId);
        break;
        
      // Submission APIs  
      case 'submitAssignment':
        result = submitAssignment(data);
        break;
      case 'getSubmissions':
        result = getSubmissions(data.assignmentId);
        break;
      case 'getStudentSubmission':
        result = getStudentSubmission(data.assignmentId, data.studentId);
        break;
        
      // Grading APIs
      case 'gradeSubmission':
        result = gradeSubmission(data.submissionId);
        break;
      case 'gradeAllSubmissions':
        result = gradeAllSubmissions(data.assignmentId);
        break;
        
      // API Key APIs
      case 'getApiKeys':
        result = getApiKeys();
        break;
      case 'addApiKey':
        result = addApiKey(data.name, data.key);
        break;
      case 'removeApiKey':
        result = removeApiKey(data.keyId);
        break;
      case 'toggleApiKey':
        result = toggleApiKey(data.keyId);
        break;
        
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('doPost error:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =================================================================
// INITIALIZATION
// =================================================================

function ensureSheetsReady() {
  if (SHEETS) return;
  
  ss = SpreadsheetApp.openById(SHEET_ID);
  
  SHEETS = {
    ASSIGNMENTS: getOrCreateSheet('Assignments', [
      'AssignmentID', 'ClassID', 'Title', 'Description', 'ProblemText',
      'AttachmentFileId', 'AttachmentFileName', 'SolutionImageIds',
      'DueDate', 'CreatedAt', 'TeacherID'
    ]),
    SUBMISSIONS: getOrCreateSheet('Submissions', [
      'SubmissionID', 'AssignmentID', 'StudentID', 'StudentName', 'StudentEmail',
      'ImageIds', 'TextAnswer', 'Score', 'Feedback', 'IsGraded',
      'SubmittedAt', 'GradedAt'
    ]),
    API_KEYS: getOrCreateSheet('ApiKeys', [
      'KeyID', 'Name', 'Key', 'IsActive', 'UsageCount', 'LastUsed', 'CreatedAt'
    ])
  };
}

function getOrCreateSheet(name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

// =================================================================
// DRIVE FUNCTIONS
// =================================================================

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  const folder = DriveApp.createFolder(folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function uploadImageToDrive(base64Data, fileName, folderType) {
  try {
    if (!base64Data || !base64Data.trim()) {
      return { success: false, error: 'Empty image data' };
    }
    
    // Remove data URL prefix if present
    let cleanBase64 = base64Data;
    if (base64Data.includes(',')) {
      cleanBase64 = base64Data.split(',')[1];
    }
    
    const blob = Utilities.newBlob(
      Utilities.base64Decode(cleanBase64),
      'image/jpeg',
      fileName
    );
    
    if (blob.getBytes().length > CONFIG.MAX_IMAGE_SIZE) {
      return { success: false, error: 'Image too large (max 10MB)' };
    }
    
    const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDERS[folderType]);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      fileId: file.getId(),
      viewUrl: `https://drive.google.com/uc?id=${file.getId()}`,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w400`
    };
  } catch (e) {
    console.error('Upload error:', e);
    return { success: false, error: e.toString() };
  }
}

function uploadMultipleImages(base64Images, baseFileName, folderType) {
  if (!Array.isArray(base64Images) || base64Images.length === 0) {
    return { success: true, fileIds: [] };
  }
  
  const fileIds = [];
  const errors = [];
  
  for (let i = 0; i < base64Images.length; i++) {
    const fileName = `${baseFileName}_${i + 1}_${Date.now()}.jpg`;
    const result = uploadImageToDrive(base64Images[i], fileName, folderType);
    
    if (result.success) {
      fileIds.push(result.fileId);
    } else {
      errors.push(`Image ${i + 1}: ${result.error}`);
    }
  }
  
  return {
    success: fileIds.length > 0,
    fileIds: fileIds,
    errors: errors.length > 0 ? errors : undefined
  };
}

function getImageBase64FromDrive(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    return {
      success: true,
      base64: Utilities.base64Encode(blob.getBytes()),
      mimeType: blob.getContentType()
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function deleteFileFromDrive(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// ASSIGNMENT FUNCTIONS
// =================================================================

function createAssignment(data) {
  try {
    ensureSheetsReady();
    
    const assignmentId = 'ASSIGN_' + Date.now();
    const now = new Date().toISOString();
    
    // Upload attachment if provided
    let attachmentFileId = '';
    let attachmentFileName = '';
    
    if (data.attachmentBase64 && data.attachmentFileName) {
      const uploadResult = uploadImageToDrive(
        data.attachmentBase64,
        data.attachmentFileName,
        'ASSIGNMENTS'
      );
      if (uploadResult.success) {
        attachmentFileId = uploadResult.fileId;
        attachmentFileName = data.attachmentFileName;
      }
    }
    
    // Upload solution images
    let solutionImageIds = [];
    if (data.solutionImages && data.solutionImages.length > 0) {
      const uploadResult = uploadMultipleImages(
        data.solutionImages,
        `solution_${assignmentId}`,
        'SOLUTIONS'
      );
      if (uploadResult.success) {
        solutionImageIds = uploadResult.fileIds;
      }
    }
    
    // Save to sheet
    SHEETS.ASSIGNMENTS.appendRow([
      assignmentId,
      data.classId || '',
      data.title || '',
      data.description || '',
      data.problemText || '',
      attachmentFileId,
      attachmentFileName,
      JSON.stringify(solutionImageIds),
      data.dueDate || '',
      now,
      data.teacherId || ''
    ]);
    
    return {
      success: true,
      assignmentId: assignmentId,
      solutionImagesCount: solutionImageIds.length,
      attachmentFileId: attachmentFileId
    };
    
  } catch (e) {
    console.error('createAssignment error:', e);
    return { success: false, error: e.toString() };
  }
}

function getAssignments(classId) {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.ASSIGNMENTS.getDataRange().getValues();
    const headers = data[0];
    const assignments = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowClassId = row[headers.indexOf('ClassID')];
      
      if (!classId || rowClassId === classId) {
        const solutionIds = row[headers.indexOf('SolutionImageIds')];
        let solutionImageIds = [];
        try {
          solutionImageIds = JSON.parse(solutionIds || '[]');
        } catch (e) {}
        
        assignments.push({
          id: row[headers.indexOf('AssignmentID')],
          classId: rowClassId,
          title: row[headers.indexOf('Title')],
          description: row[headers.indexOf('Description')],
          problemText: row[headers.indexOf('ProblemText')],
          attachmentFileId: row[headers.indexOf('AttachmentFileId')],
          attachmentFileName: row[headers.indexOf('AttachmentFileName')],
          attachmentUrl: row[headers.indexOf('AttachmentFileId')] 
            ? `https://drive.google.com/uc?id=${row[headers.indexOf('AttachmentFileId')]}` 
            : null,
          solutionImageIds: solutionImageIds,
          solutionImagesCount: solutionImageIds.length,
          dueDate: row[headers.indexOf('DueDate')],
          createdAt: row[headers.indexOf('CreatedAt')],
          teacherId: row[headers.indexOf('TeacherID')]
        });
      }
    }
    
    return { success: true, assignments: assignments };
    
  } catch (e) {
    console.error('getAssignments error:', e);
    return { success: false, error: e.toString() };
  }
}

function deleteAssignment(assignmentId) {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.ASSIGNMENTS.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('AssignmentID')] === assignmentId) {
        // Delete files from Drive
        const attachmentId = data[i][headers.indexOf('AttachmentFileId')];
        if (attachmentId) deleteFileFromDrive(attachmentId);
        
        const solutionIds = data[i][headers.indexOf('SolutionImageIds')];
        try {
          const ids = JSON.parse(solutionIds || '[]');
          ids.forEach(id => deleteFileFromDrive(id));
        } catch (e) {}
        
        // Delete row
        SHEETS.ASSIGNMENTS.deleteRow(i + 1);
        
        // Also delete submissions
        deleteSubmissionsByAssignment(assignmentId);
        
        return { success: true };
      }
    }
    
    return { success: false, error: 'Assignment not found' };
    
  } catch (e) {
    console.error('deleteAssignment error:', e);
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// SUBMISSION FUNCTIONS
// =================================================================

function submitAssignment(data) {
  try {
    ensureSheetsReady();
    
    // Check if already submitted
    const existing = getStudentSubmission(data.assignmentId, data.studentId);
    if (existing.success && existing.submission) {
      return { success: false, error: 'Bạn đã nộp bài này rồi' };
    }
    
    const submissionId = 'SUB_' + Date.now();
    const now = new Date().toISOString();
    
    // Upload images
    let imageIds = [];
    if (data.images && data.images.length > 0) {
      const uploadResult = uploadMultipleImages(
        data.images,
        `submission_${data.studentId}_${data.assignmentId}`,
        'SUBMISSIONS'
      );
      if (uploadResult.success) {
        imageIds = uploadResult.fileIds;
      } else {
        return { success: false, error: 'Lỗi upload ảnh: ' + (uploadResult.errors?.join(', ') || 'Unknown') };
      }
    }
    
    if (imageIds.length === 0 && !data.textAnswer?.trim()) {
      return { success: false, error: 'Cần ít nhất 1 ảnh hoặc câu trả lời' };
    }
    
    // Save to sheet
    SHEETS.SUBMISSIONS.appendRow([
      submissionId,
      data.assignmentId,
      data.studentId,
      data.studentName || '',
      data.studentEmail || '',
      JSON.stringify(imageIds),
      data.textAnswer || '',
      '', // Score
      '', // Feedback
      'false', // IsGraded
      now,
      '' // GradedAt
    ]);
    
    return {
      success: true,
      submissionId: submissionId,
      imagesCount: imageIds.length
    };
    
  } catch (e) {
    console.error('submitAssignment error:', e);
    return { success: false, error: e.toString() };
  }
}

function getSubmissions(assignmentId) {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.SUBMISSIONS.getDataRange().getValues();
    const headers = data[0];
    const submissions = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[headers.indexOf('AssignmentID')] === assignmentId) {
        let imageIds = [];
        try {
          imageIds = JSON.parse(row[headers.indexOf('ImageIds')] || '[]');
        } catch (e) {}
        
        submissions.push({
          id: row[headers.indexOf('SubmissionID')],
          assignmentId: row[headers.indexOf('AssignmentID')],
          studentId: row[headers.indexOf('StudentID')],
          studentName: row[headers.indexOf('StudentName')],
          studentEmail: row[headers.indexOf('StudentEmail')],
          imageIds: imageIds,
          imagesCount: imageIds.length,
          textAnswer: row[headers.indexOf('TextAnswer')],
          score: row[headers.indexOf('Score')],
          feedback: row[headers.indexOf('Feedback')],
          isGraded: row[headers.indexOf('IsGraded')] === 'true',
          submittedAt: row[headers.indexOf('SubmittedAt')],
          gradedAt: row[headers.indexOf('GradedAt')]
        });
      }
    }
    
    return { success: true, submissions: submissions };
    
  } catch (e) {
    console.error('getSubmissions error:', e);
    return { success: false, error: e.toString() };
  }
}

function getStudentSubmission(assignmentId, studentId) {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.SUBMISSIONS.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[headers.indexOf('AssignmentID')] === assignmentId &&
          row[headers.indexOf('StudentID')] === studentId) {
        
        let imageIds = [];
        try {
          imageIds = JSON.parse(row[headers.indexOf('ImageIds')] || '[]');
        } catch (e) {}
        
        return {
          success: true,
          submission: {
            id: row[headers.indexOf('SubmissionID')],
            assignmentId: row[headers.indexOf('AssignmentID')],
            studentId: row[headers.indexOf('StudentID')],
            studentName: row[headers.indexOf('StudentName')],
            imageIds: imageIds,
            imagesCount: imageIds.length,
            textAnswer: row[headers.indexOf('TextAnswer')],
            score: row[headers.indexOf('Score')],
            feedback: row[headers.indexOf('Feedback')],
            isGraded: row[headers.indexOf('IsGraded')] === 'true',
            submittedAt: row[headers.indexOf('SubmittedAt')],
            gradedAt: row[headers.indexOf('GradedAt')]
          }
        };
      }
    }
    
    return { success: true, submission: null };
    
  } catch (e) {
    console.error('getStudentSubmission error:', e);
    return { success: false, error: e.toString() };
  }
}

function deleteSubmissionsByAssignment(assignmentId) {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.SUBMISSIONS.getDataRange().getValues();
    const headers = data[0];
    
    // Find rows to delete (from bottom to top)
    const rowsToDelete = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('AssignmentID')] === assignmentId) {
        rowsToDelete.push(i + 1);
        
        // Delete images
        const imageIds = data[i][headers.indexOf('ImageIds')];
        try {
          const ids = JSON.parse(imageIds || '[]');
          ids.forEach(id => deleteFileFromDrive(id));
        } catch (e) {}
      }
    }
    
    // Delete from bottom to top
    rowsToDelete.reverse().forEach(row => {
      SHEETS.SUBMISSIONS.deleteRow(row);
    });
    
    return { success: true, deletedCount: rowsToDelete.length };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// GRADING FUNCTIONS
// =================================================================

function gradeSubmission(submissionId) {
  try {
    ensureSheetsReady();
    
    // Find submission
    const subData = SHEETS.SUBMISSIONS.getDataRange().getValues();
    const subHeaders = subData[0];
    let submission = null;
    let submissionRow = -1;
    
    for (let i = 1; i < subData.length; i++) {
      if (subData[i][subHeaders.indexOf('SubmissionID')] === submissionId) {
        submission = {
          assignmentId: subData[i][subHeaders.indexOf('AssignmentID')],
          imageIds: JSON.parse(subData[i][subHeaders.indexOf('ImageIds')] || '[]'),
          textAnswer: subData[i][subHeaders.indexOf('TextAnswer')]
        };
        submissionRow = i + 1;
        break;
      }
    }
    
    if (!submission) {
      return { success: false, error: 'Không tìm thấy bài nộp' };
    }
    
    // Find assignment
    const assignData = SHEETS.ASSIGNMENTS.getDataRange().getValues();
    const assignHeaders = assignData[0];
    let assignment = null;
    
    for (let i = 1; i < assignData.length; i++) {
      if (assignData[i][assignHeaders.indexOf('AssignmentID')] === submission.assignmentId) {
        assignment = {
          problemText: assignData[i][assignHeaders.indexOf('ProblemText')],
          solutionImageIds: JSON.parse(assignData[i][assignHeaders.indexOf('SolutionImageIds')] || '[]')
        };
        break;
      }
    }
    
    if (!assignment) {
      return { success: false, error: 'Không tìm thấy bài tập' };
    }
    
    if (assignment.solutionImageIds.length === 0) {
      return { success: false, error: 'Bài tập chưa có đáp án để chấm' };
    }
    
    // OCR teacher solutions
    console.log('OCR đáp án giáo viên...');
    let teacherSolution = '';
    for (const fileId of assignment.solutionImageIds) {
      const imgData = getImageBase64FromDrive(fileId);
      if (imgData.success) {
        const ocrResult = callGeminiOCR(imgData.base64, 'teacher_solution');
        if (ocrResult.success) {
          teacherSolution += ocrResult.text + '\n\n';
        }
      }
    }
    
    if (!teacherSolution.trim()) {
      return { success: false, error: 'Không thể đọc đáp án giáo viên' };
    }
    
    // OCR student submission
    console.log('OCR bài làm học sinh...');
    let studentAnswer = submission.textAnswer || '';
    for (const fileId of submission.imageIds) {
      const imgData = getImageBase64FromDrive(fileId);
      if (imgData.success) {
        const ocrResult = callGeminiOCR(imgData.base64, 'student_work');
        if (ocrResult.success) {
          studentAnswer += '\n\n[Bài làm từ ảnh]\n' + ocrResult.text;
        }
      }
    }
    
    if (!studentAnswer.trim()) {
      return { success: false, error: 'Không thể đọc bài làm học sinh' };
    }
    
    // Grade
    console.log('Đang chấm bài...');
    const gradingResult = callGeminiGrading(
      assignment.problemText,
      teacherSolution,
      studentAnswer
    );
    
    if (!gradingResult.success) {
      return { success: false, error: 'Lỗi chấm bài: ' + gradingResult.error };
    }
    
    // Update submission
    const scoreCol = subHeaders.indexOf('Score') + 1;
    const feedbackCol = subHeaders.indexOf('Feedback') + 1;
    const isGradedCol = subHeaders.indexOf('IsGraded') + 1;
    const gradedAtCol = subHeaders.indexOf('GradedAt') + 1;
    
    SHEETS.SUBMISSIONS.getRange(submissionRow, scoreCol).setValue(gradingResult.score);
    SHEETS.SUBMISSIONS.getRange(submissionRow, feedbackCol).setValue(gradingResult.feedback);
    SHEETS.SUBMISSIONS.getRange(submissionRow, isGradedCol).setValue('true');
    SHEETS.SUBMISSIONS.getRange(submissionRow, gradedAtCol).setValue(new Date().toISOString());
    
    return {
      success: true,
      score: gradingResult.score,
      feedback: gradingResult.feedback
    };
    
  } catch (e) {
    console.error('gradeSubmission error:', e);
    return { success: false, error: e.toString() };
  }
}

function gradeAllSubmissions(assignmentId) {
  try {
    const submissions = getSubmissions(assignmentId);
    if (!submissions.success) {
      return submissions;
    }
    
    const ungraded = submissions.submissions.filter(s => !s.isGraded);
    if (ungraded.length === 0) {
      return { success: true, message: 'Không có bài nào cần chấm', gradedCount: 0 };
    }
    
    const results = [];
    let gradedCount = 0;
    let errorCount = 0;
    
    for (const sub of ungraded) {
      console.log(`Chấm bài ${sub.id}...`);
      const result = gradeSubmission(sub.id);
      
      if (result.success) {
        gradedCount++;
        results.push({ submissionId: sub.id, success: true, score: result.score });
      } else {
        errorCount++;
        results.push({ submissionId: sub.id, success: false, error: result.error });
      }
      
      // Delay to avoid rate limiting
      Utilities.sleep(3000);
    }
    
    return {
      success: true,
      gradedCount: gradedCount,
      errorCount: errorCount,
      results: results
    };
    
  } catch (e) {
    console.error('gradeAllSubmissions error:', e);
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// GEMINI AI FUNCTIONS
// =================================================================

function getActiveApiKey() {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.API_KEYS.getDataRange().getValues();
    const headers = data[0];
    
    const activeKeys = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('IsActive')] === 'true') {
        activeKeys.push({
          row: i + 1,
          key: data[i][headers.indexOf('Key')],
          usageCount: parseInt(data[i][headers.indexOf('UsageCount')] || '0')
        });
      }
    }
    
    if (activeKeys.length === 0) return null;
    
    // Round-robin by usage
    activeKeys.sort((a, b) => a.usageCount - b.usageCount);
    const selected = activeKeys[0];
    
    // Update usage
    const usageCol = headers.indexOf('UsageCount') + 1;
    const lastUsedCol = headers.indexOf('LastUsed') + 1;
    SHEETS.API_KEYS.getRange(selected.row, usageCol).setValue(selected.usageCount + 1);
    SHEETS.API_KEYS.getRange(selected.row, lastUsedCol).setValue(new Date().toISOString());
    
    return selected.key;
    
  } catch (e) {
    console.error('getActiveApiKey error:', e);
    return null;
  }
}

function callGeminiOCR(base64Image, type) {
  try {
    const apiKey = getActiveApiKey();
    if (!apiKey) {
      return { success: false, error: 'Không có API key' };
    }
    
    const prompt = type === 'teacher_solution'
      ? `Bạn là chuyên gia OCR toán học. Hãy đọc và gõ lại CHÍNH XÁC nội dung đáp án trong hình ảnh.
Giữ nguyên format, thứ tự các bước giải. Sử dụng LaTeX cho công thức toán nếu có.
Chỉ trả về nội dung OCR, không giải thích thêm.`
      : `Bạn là chuyên gia OCR toán học. Hãy đọc và gõ lại CHÍNH XÁC bài làm học sinh trong hình ảnh.
Giữ nguyên thứ tự các bước làm. Ghi lại cả những chỗ làm sai, làm thiếu.
Sử dụng LaTeX cho công thức toán nếu có. Chỉ trả về nội dung OCR, không nhận xét.`;
    
    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
        ]
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
    };
    
    const response = UrlFetchApp.fetch(CONFIG.GEMINI_API_URL + '?key=' + apiKey, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const json = JSON.parse(response.getContentText());
    
    if (json.error) {
      return { success: false, error: json.error.message };
    }
    
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { success: false, error: 'Không nhận được phản hồi' };
    }
    
    return { success: true, text: text };
    
  } catch (e) {
    console.error('callGeminiOCR error:', e);
    return { success: false, error: e.toString() };
  }
}

function callGeminiGrading(problemText, teacherSolution, studentAnswer) {
  try {
    const apiKey = getActiveApiKey();
    if (!apiKey) {
      return { success: false, error: 'Không có API key' };
    }
    
    const prompt = `
Bạn là GIÁO VIÊN TOÁN HỌC CHUYÊN NGHIỆP với 20 năm kinh nghiệm chấm bài.
Nhiệm vụ: CHẤM BÀI TOÁN bằng cách so sánh chi tiết bài làm học sinh với đáp án chuẩn.

[ĐỀ BÀI]
${problemText || 'Không có đề bài cụ thể'}

[ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN]
${teacherSolution}

[BÀI LÀM CỦA HỌC SINH]
${studentAnswer}

TIÊU CHÍ CHẤM BÀI:
1. PHƯƠNG PHÁP GIẢI (4 điểm): Học sinh có chọn đúng phương pháp không?
2. CÁC BƯỚC THỰC HIỆN (4 điểm): Từng bước có chính xác không?
3. KẾT QUẢ CUỐI CÙNG (2 điểm): Đáp án có đúng không?

QUY TẮC CHẤM:
- Nếu phương pháp đúng nhưng có lỗi tính toán nhỏ: trừ 0.5-1 điểm
- Nếu thiếu bước quan trọng: trừ 1-2 điểm
- Nếu làm đúng một phần: cho điểm tương ứng
- Thang điểm: 0-10 (có thể dùng số thập phân 0.25, 0.5, 0.75)

HÃY TRẢ VỀ ĐÚNG ĐỊNH DẠNG SAU:

PHÂN TÍCH CHI TIẾT:
[Phân tích từng bước của học sinh]

ĐIỂM THÀNH PHẦN:
- Phương pháp giải: X/4 điểm
- Các bước thực hiện: Y/4 điểm  
- Kết quả cuối cùng: Z/2 điểm

ĐIỂM TỔNG: A/10

NHẬN XÉT CHI TIẾT:
[Nhận xét cụ thể về từng phần làm đúng/sai]

G��I Ý CẢI THIỆN:
[Hướng dẫn học sinh khắc phục lỗi sai]
`;
    
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
    };
    
    const response = UrlFetchApp.fetch(CONFIG.GEMINI_API_URL + '?key=' + apiKey, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const json = JSON.parse(response.getContentText());
    
    if (json.error) {
      return { success: false, error: json.error.message };
    }
    
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { success: false, error: 'Không nhận được phản hồi' };
    }
    
    // Extract score
    const score = extractScore(text);
    
    return {
      success: true,
      score: score,
      feedback: text
    };
    
  } catch (e) {
    console.error('callGeminiGrading error:', e);
    return { success: false, error: e.toString() };
  }
}

function extractScore(text) {
  const patterns = [
    /ĐIỂM\s*TỔNG\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*[\/\s]*10/i,
    /(\d+(?:[.,]\d+)?)\s*\/\s*10/i,
    /(\d+(?:[.,]\d+)?)\s*điểm/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let score = parseFloat(match[1].replace(',', '.'));
      if (score < 0) score = 0;
      if (score > 10) score = 10;
      return Math.round(score * 4) / 4;
    }
  }
  
  return 0;
}

// =================================================================
// API KEY MANAGEMENT
// =================================================================

function getApiKeys() {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.API_KEYS.getDataRange().getValues();
    const headers = data[0];
    const keys = [];
    
    for (let i = 1; i < data.length; i++) {
      keys.push({
        id: data[i][headers.indexOf('KeyID')],
        name: data[i][headers.indexOf('Name')],
        key: data[i][headers.indexOf('Key')],
        isActive: data[i][headers.indexOf('IsActive')] === 'true',
        usageCount: parseInt(data[i][headers.indexOf('UsageCount')] || '0'),
        lastUsed: data[i][headers.indexOf('LastUsed')],
        createdAt: data[i][headers.indexOf('CreatedAt')]
      });
    }
    
    return { success: true, keys: keys };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function addApiKey(name, key) {
  try {
    ensureSheetsReady();
    
    const keyId = 'KEY_' + Date.now();
    const now = new Date().toISOString();
    
    SHEETS.API_KEYS.appendRow([
      keyId, name, key, 'true', '0', '', now
    ]);
    
    return { success: true, keyId: keyId };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function removeApiKey(keyId) {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.API_KEYS.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('KeyID')] === keyId) {
        SHEETS.API_KEYS.deleteRow(i + 1);
        return { success: true };
      }
    }
    
    return { success: false, error: 'Key not found' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function toggleApiKey(keyId) {
  try {
    ensureSheetsReady();
    
    const data = SHEETS.API_KEYS.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('KeyID')] === keyId) {
        const currentStatus = data[i][headers.indexOf('IsActive')] === 'true';
        const col = headers.indexOf('IsActive') + 1;
        SHEETS.API_KEYS.getRange(i + 1, col).setValue(currentStatus ? 'false' : 'true');
        return { success: true, isActive: !currentStatus };
      }
    }
    
    return { success: false, error: 'Key not found' };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// =================================================================
// TEST FUNCTION
// =================================================================

function testSetup() {
  ensureSheetsReady();
  console.log('Setup complete! Sheets created.');
  
  // Create Drive folders
  Object.values(CONFIG.DRIVE_FOLDERS).forEach(name => {
    getOrCreateFolder(name);
    console.log('Folder created: ' + name);
  });
  
  console.log('All folders created!');
}
