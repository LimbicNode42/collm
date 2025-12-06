resource "aws_sqs_queue" "adjudication_queue" {
  name                        = "${local.name}-adjudication-queue.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  delay_seconds               = 0
  max_message_size            = 262144
  message_retention_seconds   = 86400
  receive_wait_time_seconds   = 10 # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.adjudication_dlq.arn
    maxReceiveCount     = 5
  })

  tags = local.tags
}

resource "aws_sqs_queue" "adjudication_dlq" {
  name                      = "${local.name}-adjudication-dlq.fifo"
  fifo_queue                = true
  message_retention_seconds = 1209600 # 14 days

  tags = local.tags
}