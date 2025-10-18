using System;
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using UnityEditor.Search;
using UnityEngine;

[CreateAssetMenu(fileName = "RecursiveDivisionGenMazeStrategy", menuName = "Strategy/RecursiveDivisionGenMazeStrategy", order = 0)]
public class RecursiveDivisionGenMazeStrategy : PathStrategy
{
    public int randomSeed = 0;
    public int delayTime = 200;
    private System.Random random;
    private int mazeCellWidth;
    private int mazeCellHeight;
    private List<Cell> cellList;

    public override string Name()
    {
        return "递归分割生成迷宫";
    }

    protected override void OnInit()
    {
        random = new System.Random(randomSeed);
        cellList = StrategyManager.Instance.cells;
        var width = StrategyManager.Instance.width;
        var height = StrategyManager.Instance.height;
        // 为了迷宫美观，确保宽度和高度都是奇数
        if (width % 2 == 0)
        {
            width++;
        }
        if (height % 2 == 0)
        {
            height++;
        }
        MainPanel.Instance.GenerateGrid(width, height);
        GenMaze().Forget();
    }

    public async UniTask GenMaze()
    {
        MainPanel.Instance.ShowMask(true);
        await GenMazeInternal();
        MainPanel.Instance.ShowMask(false);
    }

    private async UniTask GenMazeInternal()
    {
        await RecursiveDivision(0, 0, StrategyManager.Instance.width, StrategyManager.Instance.height);
        Debug.Log("GenMazeInternal done");
    }

    // 保证传入的width和height都是奇数
    private async UniTask RecursiveDivision(int x, int y, int width, int height)
    {
        if (width < 3 || height < 3)
        {
            return;
        }
        var xIndex = (random.Next(1, (width - 1) / 2) * 2) - 1 + x;
        // var temp = 
        var yIndex = (random.Next(1, (height - 1) / 2) * 2) - 1 + y;
        for (int i = x; i < x + width; i++)
        {
            for (int j = y; j < y + height; j++)
            {
                if (i == xIndex || j == yIndex)
                {
                    cellList[i + j * StrategyManager.Instance.width].SetCellType(CellType.Wall);
                }
            }
        }
        // 横纵向随机选择三个门
        var choice = random.Next(0, 4);
        // var choice = 0;
        if (choice < 2)
        {
            // 横向
            var xDoor1 = random.Next(x / 2, (xIndex - 1) / 2 + 1) * 2;
            var xDoor2 = random.Next((xIndex + 1) / 2, (x + width - 1) / 2 + 1) * 2;
            cellList[xDoor1 + yIndex * StrategyManager.Instance.width].SetCellType(CellType.Normal);
            cellList[xDoor2 + yIndex * StrategyManager.Instance.width].SetCellType(CellType.Normal);
            if (choice == 0)
            {
                var yDoor1 = random.Next(y / 2, (yIndex - 1) / 2 + 1) * 2;
                cellList[xIndex + yDoor1 * StrategyManager.Instance.width].SetCellType(CellType.Normal);
            }
            else
            {
                var yDoor2 = random.Next((yIndex + 1) / 2, (y + height - 1) / 2 + 1) * 2;
                cellList[xIndex + yDoor2 * StrategyManager.Instance.width].SetCellType(CellType.Normal);
            }
        }
        else
        {
            // 纵向
            var yDoor1 = random.Next(y / 2, (yIndex - 1) / 2 + 1) * 2;
            var yDoor2 = random.Next((yIndex + 1) / 2, (y + height - 1) / 2 + 1) * 2;
            cellList[xIndex + yDoor1 * StrategyManager.Instance.width].SetCellType(CellType.Normal);
            cellList[xIndex + yDoor2 * StrategyManager.Instance.width].SetCellType(CellType.Normal);
            if (choice == 2)
            {
                var xDoor1 = random.Next(x / 2, (xIndex - 1) / 2 + 1) * 2;
                cellList[xDoor1 + yIndex * StrategyManager.Instance.width].SetCellType(CellType.Normal);
            }
            else
            {
                var xDoor2 = random.Next((xIndex + 1) / 2, (x + width - 1) / 2 + 1) * 2;
                cellList[xDoor2 + yIndex * StrategyManager.Instance.width].SetCellType(CellType.Normal);
            }
        }

        await UniTask.Delay(delayTime);
        await RecursiveDivision(x, y, xIndex - x, yIndex - y);
        await RecursiveDivision(xIndex + 1, y, x + width - xIndex - 1, yIndex - y);
        await RecursiveDivision(x, yIndex + 1, xIndex - x, y + height - yIndex - 1);
        await RecursiveDivision(xIndex + 1, yIndex + 1, x + width - xIndex - 1, y + height - yIndex - 1);
    }

    protected override void OnDestroy()
    {
        base.OnDestroy();
    }
}