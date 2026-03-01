CREATE TABLE "Milestone" ( 
    "id" TEXT NOT NULL, 
    "name" TEXT NOT NULL, 
    "nodeId" TEXT NOT NULL, 
    "nodeState" TEXT NOT NULL, 
    "version" INTEGER NOT NULL, 
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id") 
);
